const args = new Set(process.argv.slice(2));
const expectEmpty = args.has('--expect-empty');
const expectReady = args.has('--expect-ready');

const baseUrl = process.env.SUPABASE_URL;
const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
const anonKey = process.env.SUPABASE_ANON_KEY ?? serviceRoleKey;

if (!baseUrl || !serviceRoleKey) {
  console.error('Missing SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY.');
  process.exit(1);
}

const authHeaders = {
  apikey: anonKey,
};

const restHeaders = {
  apikey: serviceRoleKey,
  Authorization: `Bearer ${serviceRoleKey}`,
  Prefer: 'return=representation',
};

async function request(url, init = {}) {
  const response = await fetch(url, init);
  const text = await response.text();
  let body = null;

  if (text) {
    try {
      body = JSON.parse(text);
    } catch {
      body = text;
    }
  }

  return {
    ok: response.ok,
    status: response.status,
    body,
  };
}

async function fetchAuthSettings() {
  return request(`${baseUrl}/auth/v1/settings`, {
    headers: authHeaders,
  });
}

async function probeTable(tableName) {
  return request(`${baseUrl}/rest/v1/${tableName}?select=id&limit=1`, {
    headers: restHeaders,
  });
}

async function probeRpc(name, body = {}) {
  return request(`${baseUrl}/rest/v1/rpc/${name}`, {
    method: 'POST',
    headers: {
      ...restHeaders,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(body),
  });
}

async function fetchBuckets() {
  return request(`${baseUrl}/storage/v1/bucket`, {
    headers: restHeaders,
  });
}

async function main() {
  const auth = await fetchAuthSettings();
  const companias = await probeTable('companias');
  const createExpediente = await probeRpc('erp_create_expediente', {
    p_payload: {
      compania_id: '00000000-0000-0000-0000-000000000001',
      empresa_facturadora_id: '00000000-0000-0000-0000-000000000001',
      tipo_siniestro: 'agua',
      descripcion: 'probe-create-expediente',
      direccion_siniestro: 'Direccion de prueba 1',
      codigo_postal: '28001',
      localidad: 'Madrid',
      provincia: 'Madrid',
      asegurado_nuevo: {
        nombre: 'Probe',
        apellidos: 'Supabase',
        telefono: '600000000',
        direccion: 'Direccion de prueba 1',
        codigo_postal: '28001',
        localidad: 'Madrid',
        provincia: 'Madrid',
      },
    },
    p_actor_id: '00000000-0000-0000-0000-000000000001',
  });
  const createCita = await probeRpc('erp_create_cita', {
    p_payload: {
      expediente_id: '00000000-0000-0000-0000-000000000001',
      operario_id: '00000000-0000-0000-0000-000000000001',
      fecha: '2026-03-17',
      franja_inicio: '09:00',
      franja_fin: '10:00',
      notas: 'probe-create-cita',
    },
    p_actor_id: '00000000-0000-0000-0000-000000000001',
  });
  const transitionExpediente = await probeRpc('erp_transition_expediente', {
    p_expediente_id: '00000000-0000-0000-0000-000000000001',
    p_estado_nuevo: 'NO_ASIGNADO',
    p_actor_id: '00000000-0000-0000-0000-000000000001',
    p_motivo: 'probe-transition',
  });
  const buckets = await fetchBuckets();

  const bucketNames = Array.isArray(buckets.body)
    ? buckets.body.map((bucket) => bucket.name ?? bucket.id).filter(Boolean)
    : [];

  const summary = {
    project_reachable: auth.ok,
    auth_status: auth.status,
    companias_status: companias.status,
    companias_body: companias.body,
    rpc_create_expediente_status: createExpediente.status,
    rpc_create_expediente_body: createExpediente.body,
    rpc_create_cita_status: createCita.status,
    rpc_create_cita_body: createCita.body,
    rpc_transition_expediente_status: transitionExpediente.status,
    rpc_transition_expediente_body: transitionExpediente.body,
    storage_buckets_status: buckets.status,
    storage_bucket_names: bucketNames,
  };

  console.log(JSON.stringify(summary, null, 2));

  const schemaMissing = companias.status === 404;
  const rpcMissing = createExpediente.status === 404;
  const citaRpcMissing = createCita.status === 404;
  const transitionRpcMissing = transitionExpediente.status === 404;

  if (expectEmpty) {
    if (!auth.ok || !schemaMissing || !rpcMissing || !citaRpcMissing || !transitionRpcMissing) {
      process.exit(1);
    }
    return;
  }

  if (expectReady) {
    if (!auth.ok || schemaMissing || rpcMissing || citaRpcMissing || transitionRpcMissing) {
      process.exit(1);
    }
  }
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
