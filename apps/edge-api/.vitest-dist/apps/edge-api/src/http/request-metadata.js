export function getRequestIp(c) {
    const forwarded = c.req.header('cf-connecting-ip') ?? c.req.header('x-forwarded-for');
    if (!forwarded) {
        return null;
    }
    const [ip] = forwarded.split(',');
    return ip?.trim() || null;
}
