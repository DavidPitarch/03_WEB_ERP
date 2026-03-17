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

async function probeRpc(name) {
  return request(`${baseUrl}/rest/v1/rpc/${name}`, {
    method: 'POST',
    headers: {
      ...restHeaders,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({}),
  });
}

async function main() {
  const auth = await fetchAuthSettings();
  const companias = await probeTable('companias');
  const createExpediente = await probeRpc('erp_create_expediente');

  const summary = {
    project_reachable: auth.ok,
    auth_status: auth.status,
    companias_status: companias.status,
    companias_body: companias.body,
    rpc_create_expediente_status: createExpediente.status,
    rpc_create_expediente_body: createExpediente.body,
  };

  console.log(JSON.stringify(summary, null, 2));

  const schemaMissing = companias.status === 404;
  const rpcMissing = createExpediente.status === 404;

  if (expectEmpty) {
    if (!auth.ok || !schemaMissing || !rpcMissing) {
      process.exit(1);
    }
    return;
  }

  if (expectReady) {
    if (!auth.ok || schemaMissing || rpcMissing) {
      process.exit(1);
    }
  }
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
