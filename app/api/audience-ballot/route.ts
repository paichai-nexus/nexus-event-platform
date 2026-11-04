export const dynamic = "force-dynamic";

function disabled() {
  return Response.json(
    {
      ok: false,
      error: {
        code: "VOTING_DISABLED",
        message: "청중평가는 종료되었습니다."
      }
    },
    { status: 410, headers: { "Cache-Control": "no-store" } }
  );
}

export const GET = disabled;
export const POST = disabled;
