import { createClient } from '@supabase/supabase-js';

const baseUrl = process.env.SUPABASE_URL;
const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
const anonKey = process.env.SUPABASE_ANON_KEY;
const remoteApiBaseUrl = (process.env.REMOTE_API_BASE_URL ?? '').replace(/\/$/, '');
const datasetTag = process.env.SPRINT56_DATASET_TAG;

if (!baseUrl || !serviceRoleKey || !anonKey || !remoteApiBaseUrl || !datasetTag) {
  console.error('Missing SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, SUPABASE_ANON_KEY, REMOTE_API_BASE_URL or SPRINT56_DATASET_TAG.');
  process.exit(1);
}

const service = createClient(baseUrl, serviceRoleKey, {
  auth: { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false },
});

const userSpecs = [
  { key: 'admin', email: process.env.ERP_GATE_ADMIN_EMAIL ?? 'admin.gate@erp.local', password: process.env.ERP_GATE_ADMIN_PASSWORD ?? 'ChangeMe-Admin-123!' },
  { key: 'supervisor', email: process.env.ERP_GATE_SUPERVISOR_EMAIL ?? 'supervisor.gate@erp.local', password: process.env.ERP_GATE_SUPERVISOR_PASSWORD ?? 'ChangeMe-Supervisor-123!' },
  { key: 'financiero', email: process.env.ERP_GATE_FINANCIERO_EMAIL ?? 'financiero.gate@erp.local', password: process.env.ERP_GATE_FINANCIERO_PASSWORD ?? 'ChangeMe-Financiero-123!' },
  { key: 'operario', email: process.env.ERP_GATE_OPERARIO_EMAIL ?? 'operario.gate@erp.local', password: process.env.ERP_GATE_OPERARIO_PASSWORD ?? 'ChangeMe-Operario-123!' },
  { key: 'perito', email: process.env.ERP_GATE_PERITO_EMAIL ?? 'perito.gate@erp.local', password: process.env.ERP_GATE_PERITO_PASSWORD ?? 'ChangeMe-Perito-123!' },
];

async function signIn(email, password) {
  const client = createClient(baseUrl, anonKey, {
    auth: { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false },
  });
  const { data, error } = await client.auth.signInWithPassword({ email, password });
  if (error || !data.session?.access_token) {
    throw new Error(`Failed to sign in ${email}: ${error?.message}`);
  }
  return data.session.access_token;
}

async function apiRequest(token, path, init = {}) {
  const response = await fetch(`${remoteApiBaseUrl}${path}`, {
    ...init,
    headers: {
      Authorization: `Bearer ${token}`,
      'Content-Type': 'application/json',
      ...(init.headers ?? {}),
    },
  });
  const text = await response.text();
  let body = null;

  if (text) {
    try {
      body = JSON.parse(text);
    } catch {
      body = text;
    }
  }

  return { ok: response.ok, status: response.status, body };
}

async function restRequest(token, path) {
  const response = await fetch(`${baseUrl}/rest/v1/${path}`, {
    headers: {
      apikey: anonKey,
      Authorization: `Bearer ${token}`,
    },
  });
  const text = await response.text();
  let body = null;

  if (text) {
    try {
      body = JSON.parse(text);
    } catch {
      body = text;
    }
  }

  return { ok: response.ok, status: response.status, body };
}

async function main() {
  const tokens = {};
  for (const spec of userSpecs) {
    tokens[spec.key] = await signIn(spec.email, spec.password);
  }

  const { data: vp, error: vpErr } = await service
    .from('vp_videoperitaciones')
    .select('id, expediente_id, perito_id, numero_caso')
    .eq('referencia_externa', datasetTag)
    .order('created_at', { ascending: false })
    .limit(1)
    .single();

  if (vpErr || !vp?.id) {
    throw new Error(`VP dataset not found for tag ${datasetTag}`);
  }

  const { data: artefacto, error: artefactoErr } = await service
    .from('vp_artefactos')
    .select('id, storage_path')
    .eq('videoperitacion_id', vp.id)
    .order('created_at', { ascending: false })
    .limit(1)
    .single();

  if (artefactoErr || !artefacto?.id) {
    throw new Error(`VP artifact not found for ${vp.id}`);
  }

  const health = await fetch(`${remoteApiBaseUrl}/health`).then(async (response) => ({
    status: response.status,
    body: await response.json(),
  }));

  const signedUrlRes = await apiRequest(tokens.admin, `/api/v1/videoperitaciones/artefactos/${artefacto.id}/signed-url`);
  const signedUrl = signedUrlRes.body?.data?.url ?? null;
  const signedFetchStatus = signedUrl ? (await fetch(signedUrl)).status : null;

  const publicFetchStatus = await fetch(`${baseUrl}/storage/v1/object/public/vp-artefactos/${artefacto.storage_path}`).then((response) => response.status);
  const directAuthenticatedStatus = await fetch(`${baseUrl}/storage/v1/object/authenticated/vp-artefactos/${artefacto.storage_path}`, {
    headers: {
      apikey: anonKey,
      Authorization: `Bearer ${tokens.operario}`,
    },
  }).then((response) => response.status);

  const adminDocFinal = await apiRequest(tokens.admin, `/api/v1/videoperitaciones/${vp.id}/documento-final`);
  const adminEnvios = await apiRequest(tokens.admin, `/api/v1/videoperitaciones/${vp.id}/envios`);
  const adminArtefactos = await apiRequest(tokens.admin, `/api/v1/videoperitaciones/${vp.id}/artefactos`);
  const adminTranscripciones = await apiRequest(tokens.admin, `/api/v1/videoperitaciones/${vp.id}/transcripciones`);
  const adminDictamenes = await apiRequest(tokens.admin, `/api/v1/videoperitaciones/${vp.id}/dictamenes`);
  const adminInformes = await apiRequest(tokens.admin, `/api/v1/videoperitaciones/${vp.id}/informes`);
  const adminValoracion = await apiRequest(tokens.admin, `/api/v1/videoperitaciones/${vp.id}/valoracion`);
  const runScheduled = await apiRequest(tokens.admin, '/api/v1/internal/run-scheduled', { method: 'POST', body: '{}' });

  const peritoVp = await restRequest(tokens.perito, `vp_videoperitaciones?select=id,numero_caso,perito_id&id=eq.${vp.id}`);
  const peritoArtefactos = await restRequest(tokens.perito, `vp_artefactos?select=id,videoperitacion_id,visibility_scope&videoperitacion_id=eq.${vp.id}`);
  const peritoTranscripciones = await restRequest(tokens.perito, `vp_transcripciones?select=id,videoperitacion_id&videoperitacion_id=eq.${vp.id}`);
  const peritoInformes = await restRequest(tokens.perito, `vp_informes?select=id,videoperitacion_id,estado&videoperitacion_id=eq.${vp.id}`);
  const peritoDocumento = await restRequest(tokens.perito, `vp_documento_final?select=id,videoperitacion_id,estado&videoperitacion_id=eq.${vp.id}`);
  const peritoEnvios = await restRequest(tokens.perito, `vp_envios?select=id,videoperitacion_id&videoperitacion_id=eq.${vp.id}`);

  const operarioVp = await restRequest(tokens.operario, `vp_videoperitaciones?select=id&id=eq.${vp.id}`);
  const operarioArtefactos = await restRequest(tokens.operario, `vp_artefactos?select=id&videoperitacion_id=eq.${vp.id}`);
  const operarioDocumento = await restRequest(tokens.operario, `vp_documento_final?select=id&videoperitacion_id=eq.${vp.id}`);
  const operarioEnvios = await restRequest(tokens.operario, `vp_envios?select=id&videoperitacion_id=eq.${vp.id}`);

  const { data: accessLogs } = await service
    .from('vp_accesos_artefacto')
    .select('id,user_id,access_type,created_at')
    .eq('artefacto_id', artefacto.id)
    .order('created_at', { ascending: false })
    .limit(5);

  const { data: pedido } = await service
    .from('pedidos_material')
    .select('id,estado,caducado_at')
    .eq('expediente_id', vp.expediente_id)
    .order('created_at', { ascending: false })
    .limit(1)
    .single();

  const { data: factura } = await service
    .from('facturas')
    .select('id,estado,estado_cobro,fecha_vencimiento')
    .eq('expediente_id', vp.expediente_id)
    .order('created_at', { ascending: false })
    .limit(1)
    .single();

  console.log(JSON.stringify({
    dataset_tag: datasetTag,
    remote_api_base_url: remoteApiBaseUrl,
    health,
    documental: {
      signed_url_status: signedUrlRes.status,
      signed_url_expires_in: signedUrlRes.body?.data?.expires_in ?? null,
      signed_url_fetch_status: signedFetchStatus,
      public_fetch_status: publicFetchStatus,
      direct_authenticated_fetch_status: directAuthenticatedStatus,
      access_log_count: accessLogs?.length ?? 0,
    },
    backend_visibility: {
      documento_final_status: adminDocFinal.status,
      envios_status: adminEnvios.status,
      artefactos_status: adminArtefactos.status,
      transcripciones_status: adminTranscripciones.status,
      dictamenes_status: adminDictamenes.status,
      informes_status: adminInformes.status,
      valoracion_status: adminValoracion.status,
    },
    direct_rls: {
      perito: {
        vp_rows: Array.isArray(peritoVp.body) ? peritoVp.body.length : 0,
        artefactos_rows: Array.isArray(peritoArtefactos.body) ? peritoArtefactos.body.length : 0,
        transcripciones_rows: Array.isArray(peritoTranscripciones.body) ? peritoTranscripciones.body.length : 0,
        informes_rows: Array.isArray(peritoInformes.body) ? peritoInformes.body.length : 0,
        documento_rows: Array.isArray(peritoDocumento.body) ? peritoDocumento.body.length : 0,
        envios_rows: Array.isArray(peritoEnvios.body) ? peritoEnvios.body.length : 0,
      },
      operario: {
        vp_rows: Array.isArray(operarioVp.body) ? operarioVp.body.length : 0,
        artefactos_rows: Array.isArray(operarioArtefactos.body) ? operarioArtefactos.body.length : 0,
        documento_rows: Array.isArray(operarioDocumento.body) ? operarioDocumento.body.length : 0,
        envios_rows: Array.isArray(operarioEnvios.body) ? operarioEnvios.body.length : 0,
      },
    },
    watchdogs: {
      trigger_status: runScheduled.status,
      trigger_results: runScheduled.body?.data?.results ?? null,
      pedido_estado: pedido?.estado ?? null,
      pedido_caducado_at: pedido?.caducado_at ?? null,
      factura_estado: factura?.estado ?? null,
      factura_estado_cobro: factura?.estado_cobro ?? null,
      factura_fecha_vencimiento: factura?.fecha_vencimiento ?? null,
    },
  }, null, 2));
}

main().catch((error) => {
  console.error(error.message);
  process.exit(1);
});
