import { auth } from "@/auth";
import { NavbarClient } from "./NavbarClient";

export async function Navbar() {
  const session = await auth();
  
  return <NavbarClient user={session?.user} />;
}
