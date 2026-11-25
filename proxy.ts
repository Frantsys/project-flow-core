import { getToken } from "next-auth/jwt";
import { NextRequest, NextResponse } from "next/server";

export async function proxy(req: NextRequest) {
  const token = await getToken({
    req,
    secret: process.env.NEXTAUTH_SECRET,
  });

  const { pathname, search } = req.nextUrl;
  const isAuthRoute = pathname.startsWith("/auth");

  if (!token && !isAuthRoute) {
    const loginUrl = new URL("/auth/login", req.url);

    // Callback url consiste na página em que o usuário tinha a intenção de navegar
    // no momento que seu login for efetuado e sua sessão for válida novamente
    // ele é imediatamente redirecionado para essa página
    loginUrl.searchParams.set("callbackUrl", `${pathname}${search}`);

    return NextResponse.redirect(loginUrl);
  }

  // Caso o usuário já esteja autenticado e tenta acessar /login ou /signup, é redirecionado para home
  if (token && isAuthRoute) {
    return NextResponse.redirect(new URL("/", req.url));
  }

  return NextResponse.next();
}

// Impede que o proxy.ts atue em rotas de api ou em arquivos estáticos
// Isso implica que toda e qualquer rota ainda deve chamar getServerSession(authOptions) para verificar as permissões de acesso
export const config = {
  matcher: ["/((?!api|_next/static|_next/image|favicon.ico).*)"],
};
