import { NewVerificationForm } from "@/components/auth/new-verification-form";

interface NewVerificationPageProps {
  searchParams: Promise<{
    email?: string;
  }>;
}

const NewVerificationPage = async ({ searchParams }: NewVerificationPageProps) => {
  const { email } = await searchParams;
  return ( 
    <NewVerificationForm email={email} />
  );
}
 
export default NewVerificationPage;
