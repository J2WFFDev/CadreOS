import { SignUp } from "@clerk/nextjs";

export default function SignUpPage() {
  return (
    <main className="mx-auto flex min-h-screen w-full max-w-5xl items-center justify-center p-8">
      <SignUp />
    </main>
  );
}
