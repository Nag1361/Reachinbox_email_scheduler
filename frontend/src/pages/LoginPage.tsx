import { useSearchParams } from 'react-router-dom';

const LoginPage = () => {
  const [searchParams] = useSearchParams();
  const authError = searchParams.get('authError');

  return (
    <div className="flex items-center justify-center min-h-screen bg-gray-950 text-white">
      <main className="flex flex-col items-center gap-6">
        <h1 className="text-2xl font-semibold">Sign in to ReachInbox</h1>
        {authError && <p role="alert" className="max-w-sm text-center text-sm text-rose-300">
          {authError === 'google_not_configured'
            ? 'Google sign-in is not configured. Set GOOGLE_CLIENT_ID and GOOGLE_CLIENT_SECRET in backend/.env.'
            : 'Google sign-in could not be completed. Please try again.'}
        </p>}
        <a
          href="/api/auth/google"
          className="rounded-md bg-white px-5 py-3 font-medium text-gray-950 hover:bg-gray-200"
        >
          Continue with Google
        </a>
      </main>
    </div>
  );
};

export default LoginPage;
