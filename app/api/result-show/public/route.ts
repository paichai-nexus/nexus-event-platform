import { toErrorResponse } from "@/lib/errors/domainError";
import { getPublicResultShowDeck } from "@/lib/results/resultShowStore";
export const dynamic = "force-dynamic";
export async function GET() { try { return Response.json({ ok: true, data: await getPublicResultShowDeck() }, { headers: { "Cache-Control": "no-store, max-age=0" } }); } catch (error) { return toErrorResponse(error); } }
