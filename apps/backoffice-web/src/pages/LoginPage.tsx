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
    if (error) {
      setError('Credenciales incorrectas');
    }
    setLoading(false);
  };

  return (
    <div className="login-page">
      <div className="login-card">
        <h1>ERP Siniestros</h1>
        <p>Acceso al sistema</p>
        <form onSubmit={handleSubmit}>
          <div className="form-group">
            <label htmlFor="email">Email</label>
            <input
              id="email"
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              required
              autoFocus
            />
          </div>
          <div className="form-group">
            <label htmlFor="password">Contraseña</label>
            <input
              id="password"
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              required
            />
          </div>
          {error && <div className="form-error">{error}</div>}
          <button type="submit" disabled={loading} className="btn-primary">
            {loading ? 'Accediendo...' : 'Entrar'}
          </button>
        </form>
      </div>
    </div>
  );
}
