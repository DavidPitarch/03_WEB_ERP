import { useState, type FormEvent } from 'react';
import { useAuth } from '@/lib/auth-context';

export function LoginPage() {
  const { signIn } = useAuth();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    setError('');
    setLoading(true);
    const { error } = await signIn(email, password);
    if (error) setError('Credenciales incorrectas');
    setLoading(false);
  };

  return (
    <div className="op-login">
      <div className="op-login-card">
        <h1>ERP Operario</h1>
        <p>Acceso al sistema</p>
        <form onSubmit={handleSubmit}>
          <input type="email" placeholder="Email" value={email} onChange={(e) => setEmail(e.target.value)} required autoFocus />
          <input type="password" placeholder="Contraseña" value={password} onChange={(e) => setPassword(e.target.value)} required />
          {error && <div className="op-error">{error}</div>}
          <button type="submit" disabled={loading} className="op-btn-primary">
            {loading ? 'Accediendo...' : 'Entrar'}
          </button>
        </form>
      </div>
    </div>
  );
}
