import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import Board from "@/components/Board";
import { SESSION_COOKIE, mintOwner } from "@/lib/auth";
import { sessionIsOwner } from "@/lib/http";
import { env, getBoard } from "@/lib/runtime";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

export default async function HomePage() {
	const config = env();
	const jar = await cookies();
	if (!(await sessionIsOwner(jar.get(SESSION_COOKIE)?.value, config))) redirect("/login");
	const board = await getBoard().owner(mintOwner()).view();
	return <Board initial={board} studioUrl={config.studioUrl} />;
}
