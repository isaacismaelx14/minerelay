import { AdminLoginPage } from "@/admin/client/login.client";
import { LOGIN_STYLES } from "@/admin/ui/admin-styles";

export const dynamic = "force-dynamic";

export default function LoginPage() {
  return (
    <>
      <style dangerouslySetInnerHTML={{ __html: LOGIN_STYLES }} />
      <AdminLoginPage />
    </>
  );
}
