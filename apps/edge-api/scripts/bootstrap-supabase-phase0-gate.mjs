const baseUrl = process.env.SUPABASE_URL;
const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!baseUrl || !serviceRoleKey) {
  console.error('Missing SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY.');
  process.exit(1);
}

const adminHeaders = {
  apikey: serviceRoleKey,
  Authorization: `Bearer ${serviceRoleKey}`,
  'Content-Type': 'application/json',
};

const userSpecs = [
  {
    key: 'admin',
    email: process.env.ERP_GATE_ADMIN_EMAIL ?? 'admin.gate@erp.local',
    password: process.env.ERP_GATE_ADMIN_PASSWORD ?? 'ChangeMe-Admin-123!',
    role: 'admin',
    user_metadata: { nombre: 'Admin', apellidos: 'Gate' },
  },
  {
    key: 'supervisor',
    email: process.env.ERP_GATE_SUPERVISOR_EMAIL ?? 'supervisor.gate@erp.local',
    password: process.env.ERP_GATE_SUPERVISOR_PASSWORD ?? 'ChangeMe-Supervisor-123!',
    role: 'supervisor',
    user_metadata: { nombre: 'Supervisor', apellidos: 'Gate' },
  },
  {
    key: 'tramitador',
    email: process.env.ERP_GATE_TRAMITADOR_EMAIL ?? 'tramitador.gate@erp.local',
    password: process.env.ERP_GATE_TRAMITADOR_PASSWORD ?? 'ChangeMe-Tramitador-123!',
    role: 'tramitador',
    user_metadata: { nombre: 'Tramitador', apellidos: 'Gate' },
  },
  {
    key: 'financiero',
    email: process.env.ERP_GATE_FINANCIERO_EMAIL ?? 'financiero.gate@erp.local',
    password: process.env.ERP_GATE_FINANCIERO_PASSWORD ?? 'ChangeMe-Financiero-123!',
    role: 'financiero',
    user_metadata: { nombre: 'Financiero', apellidos: 'Gate' },
  },
  {
    key: 'operario',
    email: process.env.ERP_GATE_OPERARIO_EMAIL ?? 'operario.gate@erp.local',
    password: process.env.ERP_GATE_OPERARIO_PASSWORD ?? 'ChangeMe-Operario-123!',
    role: 'operario',
    user_metadata: { nombre: 'Operario', apellidos: 'Gate' },
  },
];

const bucketSpecs = [
  { id: 'documentos', public: false },
  { id: 'evidencias', public: false },
  { id: 'vp-artefactos', public: false },
];

async function request(path, init = {}) {
  const response = await fetch(`${baseUrl}${path}`, init);
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

function normalizeUsers(body) {
  if (Array.isArray(body)) {
    return body;
  }

  if (body && Array.isArray(body.users)) {
    return body.users;
  }

  return [];
}

async function listAuthUsers() {
  const result = await request('/auth/v1/admin/users?page=1&per_page=200', {
    headers: adminHeaders,
  });

  if (!result.ok) {
    throw new Error(`Failed to list auth users: ${result.status} ${JSON.stringify(result.body)}`);
  }

  return normalizeUsers(result.body);
}

async function findUserByEmail(email) {
  const users = await listAuthUsers();
  return users.find((user) => user.email?.toLowerCase() === email.toLowerCase()) ?? null;
}

async function updateUser(userId, spec) {
  const result = await request(`/auth/v1/admin/users/${userId}`, {
    method: 'PUT',
    headers: adminHeaders,
    body: JSON.stringify({
      email: spec.email,
      password: spec.password,
      email_confirm: true,
      user_metadata: spec.user_metadata,
      app_metadata: {
        roles: [spec.role],
        bootstrap_source: 'sprint-5.5-phase0',
      },
    }),
  });

  if (!result.ok) {
    throw new Error(`Failed to update auth user ${spec.email}: ${result.status} ${JSON.stringify(result.body)}`);
  }

  return result.body?.user ?? result.body;
}

async function createOrUpdateUser(spec) {
  const createResult = await request('/auth/v1/admin/users', {
    method: 'POST',
    headers: adminHeaders,
    body: JSON.stringify({
      email: spec.email,
      password: spec.password,
      email_confirm: true,
      user_metadata: spec.user_metadata,
      app_metadata: {
        roles: [spec.role],
        bootstrap_source: 'sprint-5.5-phase0',
      },
    }),
  });

  if (createResult.ok) {
    return createResult.body?.user ?? createResult.body;
  }

  const existingUser = await findUserByEmail(spec.email);

  if (!existingUser?.id) {
    throw new Error(`Failed to create auth user ${spec.email}: ${createResult.status} ${JSON.stringify(createResult.body)}`);
  }

  return updateUser(existingUser.id, spec);
}

async function ensureBuckets() {
  const listResult = await request('/storage/v1/bucket', {
    headers: adminHeaders,
  });

  if (!listResult.ok) {
    throw new Error(`Failed to list storage buckets: ${listResult.status} ${JSON.stringify(listResult.body)}`);
  }

  const existing = new Set((Array.isArray(listResult.body) ? listResult.body : []).map((bucket) => bucket.id ?? bucket.name));
  const ensured = [];

  for (const bucket of bucketSpecs) {
    if (!existing.has(bucket.id)) {
      const createResult = await request('/storage/v1/bucket', {
        method: 'POST',
        headers: adminHeaders,
        body: JSON.stringify({
          id: bucket.id,
          name: bucket.id,
          public: bucket.public,
        }),
      });

      if (!createResult.ok) {
        throw new Error(`Failed to create bucket ${bucket.id}: ${createResult.status} ${JSON.stringify(createResult.body)}`);
      }
    }

    ensured.push(bucket.id);
  }

  return ensured;
}

async function callSeedRpc(userIds) {
  const result = await request('/rest/v1/rpc/erp_phase0_seed_minimo', {
    method: 'POST',
    headers: adminHeaders,
    body: JSON.stringify({
      p_admin_user_id: userIds.admin.id,
      p_supervisor_user_id: userIds.supervisor.id,
      p_tramitador_user_id: userIds.tramitador.id,
      p_financiero_user_id: userIds.financiero.id,
      p_operario_user_id: userIds.operario.id,
      p_operario_email: userIds.operario.email,
    }),
  });

  if (!result.ok) {
    throw new Error(`Failed to execute erp_phase0_seed_minimo: ${result.status} ${JSON.stringify(result.body)}`);
  }

  return result.body;
}

async function main() {
  const userIds = {};

  for (const spec of userSpecs) {
    const user = await createOrUpdateUser(spec);
    userIds[spec.key] = {
      id: user.id,
      email: spec.email,
      role: spec.role,
    };
  }

  const buckets = await ensureBuckets();
  const seed = await callSeedRpc(userIds);

  console.log(
    JSON.stringify(
      {
        users: userIds,
        buckets,
        seed,
      },
      null,
      2,
    ),
  );
}

main().catch((error) => {
  console.error(error.message);
  process.exit(1);
});
