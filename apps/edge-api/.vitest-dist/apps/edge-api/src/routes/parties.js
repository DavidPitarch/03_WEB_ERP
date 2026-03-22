import { Hono } from 'hono';
import { validate, validationError } from '../validation/schema';
export const partiesRoutes = new Hono();
// ─── GET /parties ─────────────────────────────────────────────
// Búsqueda/listado. Con ?q= usa RPC search_parties (FTS + trigram).
// Sin ?q= devuelve listado paginado ordenado por display_name.
partiesRoutes.get('/', async (c) => {
    const supabase = c.get('supabase');
    const q = c.req.query('q')?.trim();
    const roleCode = c.req.query('role');
    const partyType = c.req.query('type');
    const page = Math.max(1, parseInt(c.req.query('page') ?? '1'));
    const perPage = Math.min(parseInt(c.req.query('per_page') ?? '20'), 100);
    const offset = (page - 1) * perPage;
    if (q && q.length >= 2) {
        const { data, error } = await supabase.rpc('search_parties', {
            p_query: q,
            p_role_code: roleCode ?? null,
            p_limit: perPage,
            p_offset: offset,
        });
        if (error) {
            return c.json({ data: null, error: { code: 'DB_ERROR', message: error.message } }, 500);
        }
        return c.json({ data: { items: data ?? [], page, per_page: perPage }, error: null });
    }
    // Sin query: listado básico paginado
    let query = supabase
        .from('parties')
        .select(`id, party_type, display_name, is_active,
       party_phones(number, is_primary),
       party_emails(email, is_primary),
       party_system_roles(role_code)`, { count: 'exact' })
        .eq('is_active', true)
        .is('merged_into_id', null);
    if (partyType)
        query = query.eq('party_type', partyType);
    if (roleCode) {
        query = query.not('party_system_roles', 'is', null);
    }
    query = query.order('display_name').range(offset, offset + perPage - 1);
    const { data, error, count } = await query;
    if (error) {
        return c.json({ data: null, error: { code: 'DB_ERROR', message: error.message } }, 500);
    }
    return c.json({
        data: {
            items: data,
            total: count ?? 0,
            page,
            per_page: perPage,
            total_pages: Math.ceil((count ?? 0) / perPage),
        },
        error: null,
    });
});
// ─── GET /parties/role-types ──────────────────────────────────
// Debe ir antes de /:id para que no colisione
partiesRoutes.get('/role-types', async (c) => {
    const supabase = c.get('supabase');
    const { data, error } = await supabase
        .from('party_role_types')
        .select('*')
        .eq('is_active', true)
        .order('display_order');
    if (error) {
        return c.json({ data: null, error: { code: 'DB_ERROR', message: error.message } }, 500);
    }
    return c.json({ data, error: null });
});
// ─── GET /parties/duplicate-candidates ───────────────────────
partiesRoutes.get('/duplicate-candidates', async (c) => {
    const supabase = c.get('supabase');
    const user = c.get('user');
    if (!user.roles.some((r) => ['admin', 'supervisor'].includes(r))) {
        return c.json({ data: null, error: { code: 'FORBIDDEN', message: 'Sin permisos' } }, 403);
    }
    const status = c.req.query('status') ?? 'pending';
    const { data, error } = await supabase
        .from('party_duplicate_candidates')
        .select(`
      id, confidence_score, match_signals, status, created_at,
      party_a:parties!party_duplicate_candidates_party_a_id_fkey(id, display_name, party_type),
      party_b:parties!party_duplicate_candidates_party_b_id_fkey(id, display_name, party_type)
    `)
        .eq('status', status)
        .order('confidence_score', { ascending: false })
        .limit(50);
    if (error) {
        return c.json({ data: null, error: { code: 'DB_ERROR', message: error.message } }, 500);
    }
    return c.json({ data, error: null });
});
// ─── GET /parties/:id ─────────────────────────────────────────
partiesRoutes.get('/:id', async (c) => {
    const supabase = c.get('supabase');
    const id = c.req.param('id');
    const [partyRes, phonesRes, emailsRes, addressesRes, idsRes, rolesRes] = await Promise.all([
        supabase.from('parties').select('*').eq('id', id).single(),
        supabase.from('party_phones').select('*').eq('party_id', id).order('is_primary', { ascending: false }),
        supabase.from('party_emails').select('*').eq('party_id', id).order('is_primary', { ascending: false }),
        supabase.from('party_addresses').select('*').eq('party_id', id).order('is_primary', { ascending: false }),
        supabase.from('party_identifiers').select('*').eq('party_id', id),
        supabase.from('party_system_roles').select('*, party_role_types(label), companias(nombre)').eq('party_id', id),
    ]);
    if (partyRes.error || !partyRes.data) {
        return c.json({ data: null, error: { code: 'NOT_FOUND', message: 'Party no encontrado' } }, 404);
    }
    return c.json({
        data: {
            ...partyRes.data,
            phones: phonesRes.data ?? [],
            emails: emailsRes.data ?? [],
            addresses: addressesRes.data ?? [],
            identifiers: idsRes.data ?? [],
            system_roles: rolesRes.data ?? [],
        },
        error: null,
    });
});
// ─── GET /parties/:id/expedientes ────────────────────────────
partiesRoutes.get('/:id/expedientes', async (c) => {
    const supabase = c.get('supabase');
    const id = c.req.param('id');
    const { data, error } = await supabase
        .from('expediente_participants')
        .select(`
      id, role_code, is_primary, poliza_numero, notes, created_at,
      party_role_types(label),
      expedientes(id, numero_expediente, estado, tipo_siniestro, created_at,
        companias(nombre))
    `)
        .eq('party_id', id)
        .order('created_at', { ascending: false });
    if (error) {
        return c.json({ data: null, error: { code: 'DB_ERROR', message: error.message } }, 500);
    }
    return c.json({ data, error: null });
});
// ─── GET /parties/:id/interactions ───────────────────────────
partiesRoutes.get('/:id/interactions', async (c) => {
    const supabase = c.get('supabase');
    const id = c.req.param('id');
    const expedienteId = c.req.query('expediente_id');
    const page = Math.max(1, parseInt(c.req.query('page') ?? '1'));
    const perPage = Math.min(parseInt(c.req.query('per_page') ?? '20'), 100);
    let query = supabase
        .from('party_interactions')
        .select('*', { count: 'exact' })
        .eq('party_id', id)
        .order('occurred_at', { ascending: false });
    if (expedienteId)
        query = query.eq('expediente_id', expedienteId);
    query = query.range((page - 1) * perPage, page * perPage - 1);
    const { data, error, count } = await query;
    if (error) {
        return c.json({ data: null, error: { code: 'DB_ERROR', message: error.message } }, 500);
    }
    return c.json({ data: { items: data, total: count ?? 0, page, per_page: perPage }, error: null });
});
// ─── POST /parties ────────────────────────────────────────────
partiesRoutes.post('/', async (c) => {
    const supabase = c.get('adminSupabase');
    const user = c.get('user');
    const body = await c.req.json();
    const check = validate(body, {
        party_type: { required: true, isEnum: ['person', 'organization'] },
        first_name: { maxLength: 100 },
        last_name: { maxLength: 150 },
        legal_name: { maxLength: 200 },
        trade_name: { maxLength: 200 },
        notes: { maxLength: 2000 },
    });
    if (!check.ok)
        return validationError(c, check.errors);
    if (body.party_type === 'person' && !body.first_name && !body.last_name) {
        return validationError(c, { first_name: ['first_name o last_name es requerido para persona física'] });
    }
    if (body.party_type === 'organization' && !body.legal_name) {
        return validationError(c, { legal_name: ['legal_name es requerido para persona jurídica'] });
    }
    const { data, error } = await supabase
        .from('parties')
        .insert({
        party_type: body.party_type,
        first_name: body.first_name ?? null,
        last_name: body.last_name ?? null,
        second_last_name: body.second_last_name ?? null,
        birth_date: body.birth_date ?? null,
        gender: body.gender ?? null,
        legal_name: body.legal_name ?? null,
        trade_name: body.trade_name ?? null,
        display_name: body.display_name ?? '', // trigger la reescribirá
        notes: body.notes ?? null,
        tags: body.tags ?? [],
        preferred_language: body.preferred_language ?? 'es',
        created_by: user.id,
    })
        .select()
        .single();
    if (error) {
        return c.json({ data: null, error: { code: 'DB_ERROR', message: error.message } }, 500);
    }
    return c.json({ data, error: null }, 201);
});
// ─── PUT /parties/:id ─────────────────────────────────────────
partiesRoutes.put('/:id', async (c) => {
    const supabase = c.get('adminSupabase');
    const user = c.get('user');
    const id = c.req.param('id');
    const body = await c.req.json();
    const check = validate(body, {
        first_name: { maxLength: 100 },
        last_name: { maxLength: 150 },
        legal_name: { maxLength: 200 },
        trade_name: { maxLength: 200 },
        notes: { maxLength: 2000 },
    });
    if (!check.ok)
        return validationError(c, check.errors);
    // Solo actualizamos campos permitidos
    const allowed = [
        'first_name', 'last_name', 'second_last_name', 'birth_date', 'gender',
        'legal_name', 'trade_name', 'notes', 'tags', 'preferred_language',
    ];
    const updates = { updated_by: user.id };
    for (const key of allowed) {
        if (key in body)
            updates[key] = body[key];
    }
    const { data, error } = await supabase
        .from('parties')
        .update(updates)
        .eq('id', id)
        .select()
        .single();
    if (error || !data) {
        return c.json({ data: null, error: { code: 'NOT_FOUND', message: 'Party no encontrado' } }, 404);
    }
    return c.json({ data, error: null });
});
// ─── POST /parties/:id/phones ─────────────────────────────────
partiesRoutes.post('/:id/phones', async (c) => {
    const supabase = c.get('adminSupabase');
    const partyId = c.req.param('id');
    const body = await c.req.json();
    const check = validate(body, {
        number: { required: true, minLength: 6, maxLength: 20 },
        phone_type: { isEnum: ['mobile', 'home', 'work', 'fax', 'other'] },
        country_code: { maxLength: 5 },
        label: { maxLength: 100 },
    });
    if (!check.ok)
        return validationError(c, check.errors);
    // Si es primario, quitar primario de las otras
    if (body.is_primary) {
        await supabase.from('party_phones').update({ is_primary: false }).eq('party_id', partyId);
    }
    const { data, error } = await supabase
        .from('party_phones')
        .insert({
        party_id: partyId,
        number: body.number,
        phone_type: body.phone_type ?? 'mobile',
        country_code: body.country_code ?? '+34',
        extension: body.extension ?? null,
        label: body.label ?? null,
        is_primary: body.is_primary ?? false,
    })
        .select()
        .single();
    if (error) {
        return c.json({ data: null, error: { code: 'DB_ERROR', message: error.message } }, 500);
    }
    return c.json({ data, error: null }, 201);
});
// ─── DELETE /parties/:id/phones/:phoneId ─────────────────────
partiesRoutes.delete('/:id/phones/:phoneId', async (c) => {
    const supabase = c.get('adminSupabase');
    const { id: partyId, phoneId } = c.req.param();
    const { error } = await supabase
        .from('party_phones')
        .delete()
        .eq('id', phoneId)
        .eq('party_id', partyId);
    if (error) {
        return c.json({ data: null, error: { code: 'DB_ERROR', message: error.message } }, 500);
    }
    return c.json({ data: { deleted: true }, error: null });
});
// ─── POST /parties/:id/emails ─────────────────────────────────
partiesRoutes.post('/:id/emails', async (c) => {
    const supabase = c.get('adminSupabase');
    const partyId = c.req.param('id');
    const body = await c.req.json();
    const check = validate(body, {
        email: { required: true, isEmail: true },
        email_type: { isEnum: ['personal', 'work', 'other'] },
        label: { maxLength: 100 },
    });
    if (!check.ok)
        return validationError(c, check.errors);
    if (body.is_primary) {
        await supabase.from('party_emails').update({ is_primary: false }).eq('party_id', partyId);
    }
    const { data, error } = await supabase
        .from('party_emails')
        .insert({
        party_id: partyId,
        email: body.email.toLowerCase(),
        email_type: body.email_type ?? 'personal',
        label: body.label ?? null,
        is_primary: body.is_primary ?? false,
    })
        .select()
        .single();
    if (error) {
        if (error.code === '23505') {
            return c.json({ data: null, error: { code: 'DUPLICATE', message: 'Este email ya existe para este party' } }, 409);
        }
        return c.json({ data: null, error: { code: 'DB_ERROR', message: error.message } }, 500);
    }
    return c.json({ data, error: null }, 201);
});
// ─── DELETE /parties/:id/emails/:emailId ─────────────────────
partiesRoutes.delete('/:id/emails/:emailId', async (c) => {
    const supabase = c.get('adminSupabase');
    const { id: partyId, emailId } = c.req.param();
    const { error } = await supabase
        .from('party_emails')
        .delete()
        .eq('id', emailId)
        .eq('party_id', partyId);
    if (error) {
        return c.json({ data: null, error: { code: 'DB_ERROR', message: error.message } }, 500);
    }
    return c.json({ data: { deleted: true }, error: null });
});
// ─── POST /parties/:id/addresses ─────────────────────────────
partiesRoutes.post('/:id/addresses', async (c) => {
    const supabase = c.get('adminSupabase');
    const partyId = c.req.param('id');
    const body = await c.req.json();
    const check = validate(body, {
        street_line1: { required: true, maxLength: 200 },
        postal_code: { maxLength: 10 },
        city: { maxLength: 100 },
        province: { maxLength: 100 },
        address_type: {
            isEnum: ['home', 'work', 'billing', 'shipping', 'risk_location', 'postal', 'other'],
        },
        label: { maxLength: 100 },
    });
    if (!check.ok)
        return validationError(c, check.errors);
    if (body.is_primary) {
        await supabase.from('party_addresses').update({ is_primary: false }).eq('party_id', partyId);
    }
    const { data, error } = await supabase
        .from('party_addresses')
        .insert({
        party_id: partyId,
        address_type: body.address_type ?? 'home',
        label: body.label ?? null,
        street_line1: body.street_line1,
        street_line2: body.street_line2 ?? null,
        postal_code: body.postal_code ?? null,
        city: body.city ?? null,
        province: body.province ?? null,
        country: body.country ?? 'ESP',
        is_primary: body.is_primary ?? false,
    })
        .select()
        .single();
    if (error) {
        return c.json({ data: null, error: { code: 'DB_ERROR', message: error.message } }, 500);
    }
    return c.json({ data, error: null }, 201);
});
// ─── POST /parties/:id/identifiers ───────────────────────────
partiesRoutes.post('/:id/identifiers', async (c) => {
    const supabase = c.get('adminSupabase');
    const partyId = c.req.param('id');
    const body = await c.req.json();
    const check = validate(body, {
        id_type: { required: true, isEnum: ['dni', 'nie', 'cif', 'passport', 'other'] },
        id_value: { required: true, minLength: 1, maxLength: 50 },
        country: { maxLength: 3 },
    });
    if (!check.ok)
        return validationError(c, check.errors);
    const { data, error } = await supabase
        .from('party_identifiers')
        .insert({
        party_id: partyId,
        id_type: body.id_type,
        id_value: body.id_value.toUpperCase().trim(),
        country: body.country ?? 'ESP',
        is_primary: body.is_primary ?? false,
    })
        .select()
        .single();
    if (error) {
        if (error.code === '23505') {
            return c.json({ data: null, error: { code: 'DUPLICATE', message: 'Este identificador ya está registrado' } }, 409);
        }
        return c.json({ data: null, error: { code: 'DB_ERROR', message: error.message } }, 500);
    }
    return c.json({ data, error: null }, 201);
});
// ─── POST /parties/:id/interactions ──────────────────────────
partiesRoutes.post('/:id/interactions', async (c) => {
    const supabase = c.get('adminSupabase');
    const user = c.get('user');
    const partyId = c.req.param('id');
    const body = await c.req.json();
    const INTERACTION_TYPES = [
        'call_inbound', 'call_outbound', 'email_sent', 'email_received',
        'sms_sent', 'sms_received', 'whatsapp_sent', 'whatsapp_received',
        'video_call', 'visit_in_person', 'letter_sent', 'letter_received',
        'portal_access', 'note_internal', 'other',
    ];
    const check = validate(body, {
        interaction_type: { required: true, isEnum: INTERACTION_TYPES },
        expediente_id: { isUuid: true },
        subject: { maxLength: 500 },
        channel_ref: { maxLength: 254 },
    });
    if (!check.ok)
        return validationError(c, check.errors);
    const { data, error } = await supabase
        .from('party_interactions')
        .insert({
        party_id: partyId,
        expediente_id: body.expediente_id ?? null,
        interaction_type: body.interaction_type,
        direction: body.direction ?? 'n_a',
        subject: body.subject ?? null,
        body: body.body ?? null,
        outcome: body.outcome ?? 'completed',
        duration_seconds: body.duration_seconds ?? null,
        channel_ref: body.channel_ref ?? null,
        occurred_at: body.occurred_at ?? new Date().toISOString(),
        agent_id: user.id,
        created_by: user.id,
        metadata: body.metadata ?? {},
    })
        .select()
        .single();
    if (error) {
        return c.json({ data: null, error: { code: 'DB_ERROR', message: error.message } }, 500);
    }
    return c.json({ data, error: null }, 201);
});
// ─── POST /parties/:id/participants ──────────────────────────
// Añadir partido como interviniente de un expediente
partiesRoutes.post('/:id/participants', async (c) => {
    const supabase = c.get('adminSupabase');
    const user = c.get('user');
    const partyId = c.req.param('id');
    const body = await c.req.json();
    const check = validate(body, {
        expediente_id: { required: true, isUuid: true },
        role_code: { required: true, minLength: 1 },
        poliza_numero: { maxLength: 50 },
        cobertura: { maxLength: 100 },
        numero_riesgo: { maxLength: 50 },
        notes: { maxLength: 1000 },
    });
    if (!check.ok)
        return validationError(c, check.errors);
    const { data, error } = await supabase
        .from('expediente_participants')
        .insert({
        expediente_id: body.expediente_id,
        party_id: partyId,
        role_code: body.role_code,
        is_primary: body.is_primary ?? false,
        poliza_numero: body.poliza_numero ?? null,
        cobertura: body.cobertura ?? null,
        numero_riesgo: body.numero_riesgo ?? null,
        importe_franquicia: body.importe_franquicia ?? null,
        tipo_dano: body.tipo_dano ?? null,
        importe_reclamado: body.importe_reclamado ?? null,
        notes: body.notes ?? null,
        created_by: user.id,
    })
        .select()
        .single();
    if (error) {
        if (error.code === '23505') {
            return c.json({
                data: null,
                error: { code: 'DUPLICATE', message: 'Este party ya tiene este rol en el expediente' },
            }, 409);
        }
        return c.json({ data: null, error: { code: 'DB_ERROR', message: error.message } }, 500);
    }
    return c.json({ data, error: null }, 201);
});
// ─── POST /parties/merge ──────────────────────────────────────
// Solo admin. Fusiona p_merged en p_survivor via RPC.
partiesRoutes.post('/merge', async (c) => {
    const supabase = c.get('adminSupabase');
    const user = c.get('user');
    if (!user.roles.includes('admin')) {
        return c.json({ data: null, error: { code: 'FORBIDDEN', message: 'Solo administradores pueden fusionar' } }, 403);
    }
    const body = await c.req.json();
    const check = validate(body, {
        survivor_id: { required: true, isUuid: true },
        merged_id: { required: true, isUuid: true },
    });
    if (!check.ok)
        return validationError(c, check.errors);
    if (body.survivor_id === body.merged_id) {
        return validationError(c, { merged_id: ['survivor_id y merged_id no pueden ser el mismo'] });
    }
    const { error } = await supabase.rpc('merge_parties', {
        p_survivor: body.survivor_id,
        p_merged: body.merged_id,
    });
    if (error) {
        return c.json({ data: null, error: { code: 'MERGE_ERROR', message: error.message } }, 500);
    }
    return c.json({ data: { merged: true, survivor_id: body.survivor_id }, error: null });
});
// ─── PATCH /parties/duplicate-candidates/:candidateId ────────
partiesRoutes.patch('/duplicate-candidates/:candidateId', async (c) => {
    const supabase = c.get('adminSupabase');
    const user = c.get('user');
    const candidateId = c.req.param('candidateId');
    if (!user.roles.some((r) => ['admin', 'supervisor'].includes(r))) {
        return c.json({ data: null, error: { code: 'FORBIDDEN', message: 'Sin permisos' } }, 403);
    }
    const body = await c.req.json();
    const check = validate(body, {
        status: {
            required: true,
            isEnum: ['confirmed_duplicate', 'confirmed_different'],
        },
        notes: { maxLength: 500 },
    });
    if (!check.ok)
        return validationError(c, check.errors);
    const { data, error } = await supabase
        .from('party_duplicate_candidates')
        .update({
        status: body.status,
        notes: body.notes ?? null,
        reviewed_by: user.id,
        reviewed_at: new Date().toISOString(),
    })
        .eq('id', candidateId)
        .select()
        .single();
    if (error || !data) {
        return c.json({ data: null, error: { code: 'NOT_FOUND', message: 'Candidato no encontrado' } }, 404);
    }
    return c.json({ data, error: null });
});
