export default function CheckEmailPage() {
  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-50">
      <div className="text-center p-8">
        <h2 className="text-2xl font-bold mb-4">Check Your Email</h2>
        <p className="text-gray-600 mb-6">
          We've sent a confirmation link to your email. Please click the link
          to verify your account and continue setting up your company.
        </p>
        <a
          href="/auth/sign-in"
          className="bg-blue-600 text-white px-6 py-3 rounded-md hover:bg-blue-700 transition-colors"
        >
          Go to Sign In
        </a>
      </div>
    </div>
  );
}