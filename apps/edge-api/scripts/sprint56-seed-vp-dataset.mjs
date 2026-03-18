import { createClient } from '@supabase/supabase-js';

const baseUrl = process.env.SUPABASE_URL;
const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
const anonKey = process.env.SUPABASE_ANON_KEY;
const datasetTag = process.env.SPRINT56_DATASET_TAG ?? `sprint56-${new Date().toISOString().slice(0, 10)}`;

if (!baseUrl || !serviceRoleKey || !anonKey) {
  console.error('Missing SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY or SUPABASE_ANON_KEY.');
  process.exit(1);
}

const service = createClient(baseUrl, serviceRoleKey, {
  auth: { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false },
});

const adminHeaders = {
  apikey: serviceRoleKey,
  Authorization: `Bearer ${serviceRoleKey}`,
  'Content-Type': 'application/json',
};

const peritoSpec = {
  email: process.env.ERP_GATE_PERITO_EMAIL ?? 'perito.gate@erp.local',
  password: process.env.ERP_GATE_PERITO_PASSWORD ?? 'ChangeMe-Perito-123!',
  role: 'perito',
  user_metadata: { nombre: 'Perito', apellidos: 'Gate' },
};

const baseUserEmails = {
  admin: process.env.ERP_GATE_ADMIN_EMAIL ?? 'admin.gate@erp.local',
  supervisor: process.env.ERP_GATE_SUPERVISOR_EMAIL ?? 'supervisor.gate@erp.local',
  financiero: process.env.ERP_GATE_FINANCIERO_EMAIL ?? 'financiero.gate@erp.local',
  operario: process.env.ERP_GATE_OPERARIO_EMAIL ?? 'operario.gate@erp.local',
};

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

  return { ok: response.ok, status: response.status, body };
}

function normalizeUsers(body) {
  if (Array.isArray(body)) return body;
  if (body && Array.isArray(body.users)) return body.users;
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

async function createOrUpdatePeritoAuthUser() {
  const createResult = await request('/auth/v1/admin/users', {
    method: 'POST',
    headers: adminHeaders,
    body: JSON.stringify({
      email: peritoSpec.email,
      password: peritoSpec.password,
      email_confirm: true,
      user_metadata: peritoSpec.user_metadata,
      app_metadata: {
        roles: [peritoSpec.role],
        bootstrap_source: 'sprint-5.6',
      },
    }),
  });

  if (createResult.ok) {
    return createResult.body?.user ?? createResult.body;
  }

  const existing = await findUserByEmail(peritoSpec.email);
  if (!existing?.id) {
    throw new Error(`Failed to create auth user ${peritoSpec.email}: ${createResult.status} ${JSON.stringify(createResult.body)}`);
  }

  const updateResult = await request(`/auth/v1/admin/users/${existing.id}`, {
    method: 'PUT',
    headers: adminHeaders,
    body: JSON.stringify({
      email: peritoSpec.email,
      password: peritoSpec.password,
      email_confirm: true,
      user_metadata: peritoSpec.user_metadata,
      app_metadata: {
        roles: [peritoSpec.role],
        bootstrap_source: 'sprint-5.6',
      },
    }),
  });

  if (!updateResult.ok) {
    throw new Error(`Failed to update auth user ${peritoSpec.email}: ${updateResult.status} ${JSON.stringify(updateResult.body)}`);
  }

  return updateResult.body?.user ?? updateResult.body;
}

async function ensureUserProfileAndRole(userId, roleName, profile) {
  let { data: role } = await service.from('roles').select('id').eq('nombre', roleName).maybeSingle();

  if (!role?.id) {
    const insertRole = await service.from('roles').insert({
      nombre: roleName,
      descripcion: `Rol ${roleName} creado por sprint 5.6`,
    }).select('id').single();

    if (insertRole.error || !insertRole.data?.id) {
      throw new Error(`Role ${roleName} not found and could not be created`);
    }

    role = insertRole.data;
  }

  await service.from('user_profiles').upsert({
    id: userId,
    nombre: profile.nombre,
    apellidos: profile.apellidos,
    telefono: profile.telefono ?? null,
    activo: true,
  });

  await service.from('user_roles').upsert({
    user_id: userId,
    role_id: role.id,
  });
}

async function resolveBaseUsers() {
  const users = {};
  for (const [key, email] of Object.entries(baseUserEmails)) {
    const user = await findUserByEmail(email);
    if (!user?.id) {
      throw new Error(`Missing base auth user ${email}. Run Sprint 5.5 bootstrap first.`);
    }
    users[key] = { id: user.id, email };
  }
  return users;
}

async function ensurePerito(companiaId) {
  const authUser = await createOrUpdatePeritoAuthUser();

  await ensureUserProfileAndRole(authUser.id, 'perito', {
    nombre: peritoSpec.user_metadata.nombre,
    apellidos: peritoSpec.user_metadata.apellidos,
    telefono: '600123123',
  });

  const { data: existing } = await service.from('peritos').select('id').eq('user_id', authUser.id).maybeSingle();
  if (existing?.id) {
    return { userId: authUser.id, peritoId: existing.id, email: peritoSpec.email };
  }

  let insert = await service.from('peritos').insert({
    user_id: authUser.id,
    nombre: 'Perito',
    apellidos: 'Gate',
    telefono: '600123123',
    email: peritoSpec.email,
    colegiado_numero: 'COL-S56-001',
    especialidades: ['hogar'],
    compania_ids: [companiaId],
    activo: true,
  }).select('id').maybeSingle();

  if (insert.error) {
    insert = await service.from('peritos').insert({
      user_id: authUser.id,
      nombre: 'Perito',
      apellidos: 'Gate',
      telefono: '600123123',
      email: peritoSpec.email,
      compania_id: companiaId,
      activo: true,
    }).select('id').single();
  }

  if (insert.error || !insert.data?.id) {
    throw new Error(`Failed to create perito row: ${insert.error?.message}`);
  }

  return { userId: authUser.id, peritoId: insert.data.id, email: peritoSpec.email };
}

async function ensureSeries(empresaId) {
  const { data: existing } = await service.from('series_facturacion').select('id,codigo').eq('codigo', 'S56VP').maybeSingle();
  if (existing?.id) return existing;

  const { data, error } = await service.from('series_facturacion').insert({
    codigo: 'S56VP',
    nombre: 'Serie Sprint 5.6 VP',
    prefijo: 'S56VP',
    empresa_facturadora_id: empresaId,
    tipo: 'ordinaria',
    contador_actual: 0,
    activa: true,
  }).select('id,codigo').single();

  if (error) throw new Error(`Failed to create billing series: ${error.message}`);
  return data;
}

async function ensureBaremo(companiaId) {
  const today = new Date().toISOString().slice(0, 10);
  let { data: baremo } = await service
    .from('baremos')
    .select('id,nombre,version')
    .eq('compania_id', companiaId)
    .eq('nombre', 'Baremo Sprint 5.6 VP')
    .maybeSingle();

  if (!baremo) {
    const insert = await service.from('baremos').insert({
      compania_id: companiaId,
      nombre: 'Baremo Sprint 5.6 VP',
      version: 1,
      tipo: 'compania',
      vigente_desde: today,
      activo: true,
    }).select('id,nombre,version').single();

    if (insert.error) throw new Error(`Failed to create baremo: ${insert.error.message}`);
    baremo = insert.data;
  }

  const { data: existingPartidas } = await service.from('partidas_baremo').select('id,codigo,descripcion').eq('baremo_id', baremo.id).order('codigo');
  if ((existingPartidas ?? []).length >= 2) {
    return { baremo, partidas: existingPartidas };
  }

  const insert = await service.from('partidas_baremo').insert([
    {
      baremo_id: baremo.id,
      codigo: 'S56-001',
      descripcion: 'Inspeccion tecnica videoperitacion',
      unidad: 'ud',
      precio_unitario: 120,
      precio_operario: 75,
      especialidad: 'hogar',
      activa: true,
    },
    {
      baremo_id: baremo.id,
      codigo: 'S56-002',
      descripcion: 'Revision de danos y documentacion',
      unidad: 'ud',
      precio_unitario: 80,
      precio_operario: 50,
      especialidad: 'hogar',
      activa: true,
    },
  ]).select('id,codigo,descripcion').order('codigo');

  if (insert.error) throw new Error(`Failed to create baremo items: ${insert.error.message}`);
  return { baremo, partidas: insert.data };
}

async function ensureProveedor() {
  const { data: existing } = await service.from('proveedores').select('id,nombre').eq('email', 'proveedor.s56@erp.local').maybeSingle();
  if (existing?.id) return existing;

  const { data, error } = await service.from('proveedores').insert({
    nombre: 'Proveedor Sprint 5.6',
    cif: 'B76543210',
    telefono: '910000001',
    email: 'proveedor.s56@erp.local',
    direccion: 'Calle Proveedor 1',
    codigo_postal: '28002',
    localidad: 'Madrid',
    provincia: 'Madrid',
    canal_preferido: 'email',
    especialidades: ['hogar'],
    activo: true,
  }).select('id,nombre').single();

  if (error) throw new Error(`Failed to create supplier: ${error.message}`);
  return data;
}

async function createExpediente(companiaId, empresaFacturadoraId, actorId) {
  const { data, error } = await service.rpc('erp_create_expediente', {
    p_payload: {
      compania_id: companiaId,
      empresa_facturadora_id: empresaFacturadoraId,
      tipo_siniestro: 'agua',
      descripcion: `Dataset VP Sprint 5.6 ${datasetTag}`,
      direccion_siniestro: 'Calle Validacion Remota 56',
      codigo_postal: '28003',
      localidad: 'Madrid',
      provincia: 'Madrid',
      referencia_externa: datasetTag,
      asegurado_nuevo: {
        nombre: 'Cliente',
        apellidos: 'Sprint56',
        telefono: '600000056',
        email: 'cliente.s56@erp.local',
        direccion: 'Calle Validacion Remota 56',
        codigo_postal: '28003',
        localidad: 'Madrid',
        provincia: 'Madrid',
      },
    },
    p_actor_id: actorId,
  });

  if (error || !data?.id) {
    throw new Error(`Failed to create expediente: ${error?.message ?? JSON.stringify(data)}`);
  }

  return data;
}

async function uploadArtefacto(storagePath) {
  const payload = Buffer.from(`Sprint 5.6 artefacto ${datasetTag}\n${new Date().toISOString()}\n`, 'utf8');
  const result = await service.storage.from('vp-artefactos').upload(storagePath, payload, {
    contentType: 'text/plain',
    upsert: true,
  });

  if (result.error) throw new Error(`Failed to upload VP artifact: ${result.error.message}`);
}

async function main() {
  const users = await resolveBaseUsers();
  const { data: compania } = await service.from('companias').select('id,config').limit(1).single();
  const { data: empresa } = await service.from('empresas_facturadoras').select('id').limit(1).single();
  const { data: operario } = await service.from('operarios').select('id').eq('activo', true).limit(1).single();

  if (!compania?.id || !empresa?.id || !operario?.id) {
    throw new Error('Missing compania, empresa_facturadora or operario base data.');
  }

  const perito = await ensurePerito(compania.id);
  const serie = await ensureSeries(empresa.id);
  const baremoData = await ensureBaremo(compania.id);
  const proveedor = await ensureProveedor();

  await service.from('companias').update({
    config: {
      ...(compania.config ?? {}),
      informe_vp: {
        logo_url: 'https://assets.erp.local/logo-s56.png',
        color_primario: '#003a5d',
      },
      facturacion: {
        dias_vencimiento: 0,
      },
    },
  }).eq('id', compania.id);

  const expediente = await createExpediente(compania.id, empresa.id, users.admin.id);
  await service.from('expedientes').update({ perito_id: perito.peritoId, operario_id: operario.id }).eq('id', expediente.id);

  const year = new Date().getFullYear();
  const { count } = await service.from('vp_videoperitaciones').select('id', { count: 'exact', head: true }).gte('created_at', `${year}-01-01`);
  const numeroCaso = `VP-${year}-${String((count ?? 0) + 1).padStart(5, '0')}`;

  const vpInsert = await service.from('vp_videoperitaciones').insert({
    expediente_id: expediente.id,
    perito_id: perito.peritoId,
    numero_caso: numeroCaso,
    estado: 'enviado',
    prioridad: 'alta',
    motivo_tecnico: 'Validacion Sprint 5.6',
    origen: 'manual',
    referencia_externa: datasetTag,
    created_by: users.admin.id,
  }).select('id,expediente_id,numero_caso,referencia_externa').single();
  if (vpInsert.error) throw new Error(`Failed to create VP case: ${vpInsert.error.message}`);
  const vp = vpInsert.data;

  const agendaInsert = await service.from('vp_agenda').insert({
    videoperitacion_id: vp.id,
    fecha: new Date().toISOString().slice(0, 10),
    hora_inicio: '10:00',
    hora_fin: '11:00',
    estado: 'confirmada',
    link_externo: 'https://vp.example.local/sesion/s56',
    link_token: crypto.randomUUID(),
    link_expira_at: new Date(Date.now() + 86400000).toISOString(),
    link_enviado_at: new Date().toISOString(),
    link_reenvios: 1,
    notas: 'Agenda Sprint 5.6',
    created_by: users.admin.id,
  }).select('id').single();
  if (agendaInsert.error) throw new Error(`Failed to create agenda: ${agendaInsert.error.message}`);

  const sesionInsert = await service.from('vp_sesiones').insert({
    videoperitacion_id: vp.id,
    agenda_id: agendaInsert.data.id,
    external_session_id: `s56-${Date.now()}`,
    estado: 'finalizada',
    iniciada_at: new Date(Date.now() - 3600000).toISOString(),
    finalizada_at: new Date(Date.now() - 1800000).toISOString(),
    duracion_segundos: 1800,
    participantes_conectados: 2,
    participantes: [
      { role: 'perito', name: 'Perito Gate' },
      { role: 'cliente', name: 'Cliente Sprint56' },
    ],
    room_url: 'https://vp.example.local/room/s56',
  }).select('id').single();
  if (sesionInsert.error) throw new Error(`Failed to create session: ${sesionInsert.error.message}`);

  const storagePath = `${vp.id}/sprint56-${datasetTag}-artefacto.txt`;
  await uploadArtefacto(storagePath);

  const artefactoInsert = await service.from('vp_artefactos').insert({
    videoperitacion_id: vp.id,
    expediente_id: expediente.id,
    sesion_id: sesionInsert.data.id,
    tipo: 'document',
    origen: 'manual',
    storage_path: storagePath,
    nombre_original: 'sprint56-artefacto.txt',
    mime_type: 'text/plain',
    tamano_bytes: 64,
    estado_disponibilidad: 'disponible',
    politica_retencion: '365d',
    visibility_scope: 'perito',
    created_by: users.admin.id,
    subido_por: users.admin.id,
  }).select('id').single();
  if (artefactoInsert.error) throw new Error(`Failed to create artifact row: ${artefactoInsert.error.message}`);

  const transcripcionInsert = await service.from('vp_transcripciones').insert({
    artefacto_id: artefactoInsert.data.id,
    videoperitacion_id: vp.id,
    sesion_id: sesionInsert.data.id,
    idioma: 'es',
    texto_completo: 'Transcripcion Sprint 5.6 con hallazgos de humedad y dano en falso techo.',
    resumen: 'Sesion finalizada con revision de danos y evidencia documental.',
    highlights: ['humedad', 'falso techo'],
    segmentos: [{ start: 0, end: 15, speaker: 'perito', text: 'Se aprecia dano por humedad.' }],
    proveedor: 'manual',
  }).select('id').single();
  if (transcripcionInsert.error) throw new Error(`Failed to create transcript: ${transcripcionInsert.error.message}`);

  const dictamenInsert = await service.from('vp_dictamenes').insert({
    videoperitacion_id: vp.id,
    expediente_id: expediente.id,
    perito_id: perito.peritoId,
    sesion_id: sesionInsert.data.id,
    version: 2,
    estado: 'emitido',
    tipo_resolucion: 'aprobacion',
    conclusiones: 'Se confirma dano compatible con fuga de agua en cocina.',
    observaciones: 'Procede reparacion y secado.',
    hallazgos: [{ zona: 'cocina', dano: 'humedad', gravedad: 'media', descripcion: 'Mancha visible en techo' }],
    recomendaciones: 'Reparar fuga y pintar.',
    impacto_expediente: 'reactivar',
    expediente_estado_previo: 'PENDIENTE_PERITO',
    expediente_estado_nuevo: 'EN_CURSO',
    artefactos_revisados: [artefactoInsert.data.id],
    sesiones_revisadas: [sesionInsert.data.id],
    emitido_at: new Date().toISOString(),
    created_by: perito.userId,
  }).select('id').single();
  if (dictamenInsert.error) throw new Error(`Failed to create dictamen: ${dictamenInsert.error.message}`);

  const valoracionInsert = await service.from('vp_valoraciones').insert({
    videoperitacion_id: vp.id,
    expediente_id: expediente.id,
    estado: 'calculada',
    baremo_id: baremoData.baremo.id,
    baremo_version: baremoData.baremo.version,
    baremo_nombre: baremoData.baremo.nombre,
    importe_total: 200,
    importe_baremo: 200,
    importe_ajustado: 200,
    desviacion_total: 0,
    calculado_por: users.admin.id,
    calculado_at: new Date().toISOString(),
  }).select('id').single();
  if (valoracionInsert.error) throw new Error(`Failed to create valuation: ${valoracionInsert.error.message}`);

  const valoracionLineasErr = await service.from('vp_valoracion_lineas').insert([
    {
      valoracion_id: valoracionInsert.data.id,
      partida_baremo_id: baremoData.partidas[0].id,
      codigo: baremoData.partidas[0].codigo,
      descripcion: baremoData.partidas[0].descripcion,
      unidad: 'ud',
      precio_unitario_baremo: 120,
      cantidad: 1,
      precio_unitario_aplicado: 120,
      importe: 120,
      es_ajuste_manual: false,
      fuera_de_baremo: false,
      orden: 0,
    },
    {
      valoracion_id: valoracionInsert.data.id,
      partida_baremo_id: baremoData.partidas[1].id,
      codigo: baremoData.partidas[1].codigo,
      descripcion: baremoData.partidas[1].descripcion,
      unidad: 'ud',
      precio_unitario_baremo: 80,
      cantidad: 1,
      precio_unitario_aplicado: 80,
      importe: 80,
      es_ajuste_manual: false,
      fuera_de_baremo: false,
      orden: 1,
    },
  ]);
  if (valoracionLineasErr.error) throw new Error(`Failed to create valuation lines: ${valoracionLineasErr.error.message}`);

  const informeInsert = await service.from('vp_informes').insert({
    videoperitacion_id: vp.id,
    expediente_id: expediente.id,
    estado: 'validado',
    version: 2,
    datos_expediente: {
      numero_expediente: expediente.numero_expediente,
      tipo_siniestro: expediente.tipo_siniestro,
      descripcion: expediente.descripcion,
      estado: 'EN_CURSO',
    },
    datos_encargo: {
      tipo_servicio: 'videoperitacion',
      descripcion_encargo: 'Validacion Sprint 5.6',
      fecha_encargo: new Date().toISOString(),
    },
    datos_videoperitacion: {
      estado: 'valoracion_calculada',
      total_sesiones: 1,
      total_artefactos: 1,
    },
    resumen_sesion: {
      duracion_minutos: 30,
      incidencias: [],
    },
    evidencias_principales: [artefactoInsert.data.id],
    hallazgos: [{ zona: 'cocina', dano: 'humedad', gravedad: 'media', descripcion: 'Mancha visible en techo' }],
    conclusiones: 'Procede reparacion.',
    extractos_transcripcion: [{ artefacto_id: artefactoInsert.data.id, texto: 'Se aprecia dano por humedad.' }],
    resolucion_pericial: {
      tipo_resolucion: 'aprobacion',
      conclusiones: 'Se confirma el dano',
      impacto_expediente: 'reactivar',
    },
    observaciones_finales: 'Dataset Sprint 5.6',
    dictamen_id: dictamenInsert.data.id,
    valoracion_id: valoracionInsert.data.id,
    creado_por: perito.userId,
    validado_por: users.supervisor.id,
    validado_at: new Date().toISOString(),
  }).select('id').single();
  if (informeInsert.error) throw new Error(`Failed to create report: ${informeInsert.error.message}`);

  const documentoInsert = await service.from('vp_documento_final').insert({
    videoperitacion_id: vp.id,
    informe_id: informeInsert.data.id,
    expediente_id: expediente.id,
    version: 1,
    estado: 'enviado',
    contenido_json: {
      dataset_tag: datasetTag,
      expediente: expediente.numero_expediente,
      conclusiones: 'Procede reparacion.',
    },
    nombre_archivo: `informe_vp_${expediente.numero_expediente}_v1.json`,
    formato: 'json',
    config_branding: {
      logo_url: 'https://assets.erp.local/logo-s56.png',
      color_primario: '#003a5d',
    },
    generado_por: users.admin.id,
    generado_at: new Date().toISOString(),
  }).select('id').single();
  if (documentoInsert.error) throw new Error(`Failed to create final document: ${documentoInsert.error.message}`);

  const facturaInsert = await service.from('facturas').insert({
    expediente_id: expediente.id,
    numero_factura: `S56VP-${new Date().getFullYear()}-${String(Date.now()).slice(-5)}`,
    empresa_facturadora_id: empresa.id,
    serie_id: serie.id,
    compania_id: compania.id,
    fecha_emision: new Date().toISOString().slice(0, 10),
    fecha_vencimiento: new Date(Date.now() - 86400000).toISOString().slice(0, 10),
    base_imponible: 200,
    iva_porcentaje: 21,
    iva_importe: 42,
    total: 242,
    estado: 'emitida',
    estado_cobro: 'pendiente',
    emitida_por: users.financiero.id,
    origen: 'videoperitacion',
  }).select('id,numero_factura').single();
  if (facturaInsert.error) throw new Error(`Failed to create invoice: ${facturaInsert.error.message}`);

  const lineasFacturaErr = await service.from('lineas_factura').insert([
    {
      factura_id: facturaInsert.data.id,
      partida_baremo_id: baremoData.partidas[0].id,
      descripcion: baremoData.partidas[0].descripcion,
      cantidad: 1,
      precio_unitario: 120,
      importe: 120,
      descuento_porcentaje: 0,
      iva_porcentaje: 21,
      subtotal: 145.2,
    },
    {
      factura_id: facturaInsert.data.id,
      partida_baremo_id: baremoData.partidas[1].id,
      descripcion: baremoData.partidas[1].descripcion,
      cantidad: 1,
      precio_unitario: 80,
      importe: 80,
      descuento_porcentaje: 0,
      iva_porcentaje: 21,
      subtotal: 96.8,
    },
  ]);
  if (lineasFacturaErr.error) throw new Error(`Failed to create invoice lines: ${lineasFacturaErr.error.message}`);

  const vpFacturaInsert = await service.from('vp_facturas').insert({
    videoperitacion_id: vp.id,
    factura_id: facturaInsert.data.id,
    expediente_id: expediente.id,
    valoracion_id: valoracionInsert.data.id,
    informe_id: informeInsert.data.id,
    importe_valoracion: 200,
    baremo_id: baremoData.baremo.id,
    baremo_version: baremoData.baremo.version,
    emitida_por: users.financiero.id,
  }).select('id').single();
  if (vpFacturaInsert.error) throw new Error(`Failed to create VP invoice bridge: ${vpFacturaInsert.error.message}`);

  const envioInsert = await service.from('vp_envios').insert({
    videoperitacion_id: vp.id,
    expediente_id: expediente.id,
    documento_final_id: documentoInsert.data.id,
    factura_id: facturaInsert.data.id,
    canal: 'email',
    destinatario_email: 'cliente.s56@erp.local',
    destinatario_nombre: 'Cliente Sprint56',
    estado: 'acusado',
    intento_numero: 1,
    enviado_at: new Date().toISOString(),
    acuse_at: new Date().toISOString(),
    acuse_detalle: 'Recepcion confirmada en Sprint 5.6',
    enviado_por: users.financiero.id,
    metadata: { dataset_tag: datasetTag, dry_run: true },
  }).select('id').single();
  if (envioInsert.error) throw new Error(`Failed to create delivery: ${envioInsert.error.message}`);

  const timelineErr = await service.from('comunicaciones').insert({
    expediente_id: expediente.id,
    tipo: 'nota_interna',
    asunto: 'Sprint 5.6 dataset VP',
    contenido: `Dataset VP ${datasetTag} preparado para validacion remota`,
    actor_id: users.admin.id,
    actor_nombre: 'admin.gate@erp.local',
    metadata: {
      module: 'videoperitacion',
      videoperitacion_id: vp.id,
      referencia_tipo: 'videoperitacion',
      referencia_id: vp.id,
    },
  });
  if (timelineErr.error) throw new Error(`Failed to create timeline evidence: ${timelineErr.error.message}`);

  const auditErr = await service.from('auditoria').insert([
    {
      tabla: 'vp_documento_final',
      registro_id: documentoInsert.data.id,
      accion: 'INSERT',
      actor_id: users.admin.id,
      cambios: { dataset_tag: datasetTag, estado: 'enviado' },
    },
    {
      tabla: 'vp_envios',
      registro_id: envioInsert.data.id,
      accion: 'UPDATE',
      actor_id: users.financiero.id,
      cambios: { dataset_tag: datasetTag, estado: 'acusado' },
    },
  ]);
  if (auditErr.error) throw new Error(`Failed to create audit evidence: ${auditErr.error.message}`);

  const domainErr = await service.from('eventos_dominio').insert([
    {
      aggregate_id: vp.id,
      aggregate_type: 'videoperitacion',
      event_type: 'DocumentoFinalVpGenerado',
      payload: { documento_id: documentoInsert.data.id, dataset_tag: datasetTag },
      actor_id: users.admin.id,
      correlation_id: crypto.randomUUID(),
    },
    {
      aggregate_id: vp.id,
      aggregate_type: 'videoperitacion',
      event_type: 'InformeVpAcusado',
      payload: { envio_id: envioInsert.data.id, dataset_tag: datasetTag },
      actor_id: users.financiero.id,
      correlation_id: crypto.randomUUID(),
    },
  ]);
  if (domainErr.error) throw new Error(`Failed to create domain event evidence: ${domainErr.error.message}`);

  const pedidoInsert = await service.from('pedidos_material').insert({
    expediente_id: expediente.id,
    proveedor_id: proveedor.id,
    solicitado_por: users.admin.id,
    numero_pedido: `S56-PED-${String(Date.now()).slice(-6)}`,
    estado: 'enviado',
    fecha_limite: new Date(Date.now() - 86400000).toISOString(),
    enviado_at: new Date(Date.now() - 86400000).toISOString(),
    enviado_por: users.admin.id,
    created_by: users.admin.id,
  }).select('id,numero_pedido').single();
  if (pedidoInsert.error) throw new Error(`Failed to create expired order dataset: ${pedidoInsert.error.message}`);

  console.log(JSON.stringify({
    dataset_tag: datasetTag,
    users: { ...users, perito },
    expediente: {
      id: expediente.id,
      numero_expediente: expediente.numero_expediente,
    },
    videoperitacion: vp,
    agenda_id: agendaInsert.data.id,
    sesion_id: sesionInsert.data.id,
    artefacto_id: artefactoInsert.data.id,
    transcripcion_id: transcripcionInsert.data.id,
    dictamen_id: dictamenInsert.data.id,
    informe_id: informeInsert.data.id,
    valoracion_id: valoracionInsert.data.id,
    documento_final_id: documentoInsert.data.id,
    factura_id: facturaInsert.data.id,
    vp_factura_id: vpFacturaInsert.data.id,
    envio_id: envioInsert.data.id,
    pedido_id: pedidoInsert.data.id,
    storage_path: storagePath,
  }, null, 2));
}

main().catch((error) => {
  console.error(error.message);
  process.exit(1);
});
