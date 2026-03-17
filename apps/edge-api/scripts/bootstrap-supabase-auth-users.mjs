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

async function findUserByEmail(email) {
  const result = await request('/auth/v1/admin/users?page=1&per_page=200', {
    headers: adminHeaders,
  });

  if (!result.ok) {
    throw new Error(`Failed to list auth users: ${result.status} ${JSON.stringify(result.body)}`);
  }

  return normalizeUsers(result.body).find((user) => user.email?.toLowerCase() === email.toLowerCase()) ?? null;
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

async function main() {
  const result = {};

  for (const spec of userSpecs) {
    const user = await createOrUpdateUser(spec);
    result[spec.key] = {
      id: user.id,
      email: spec.email,
      role: spec.role,
    };
  }

  console.log(JSON.stringify(result, null, 2));
}

main().catch((error) => {
  console.error(error.message);
  process.exit(1);
});
