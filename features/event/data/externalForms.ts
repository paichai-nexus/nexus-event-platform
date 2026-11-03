export const EVENT_EXTERNAL_FORMS = {
  audienceJuryReservation: {
    label: "청중평가단 사전예약",
    url: "https://docs.google.com/forms/d/e/1FAIpQLSdI09IXEytrl1hxfmjxG_Hwbz4OgDtWzNYjh_yT_mRdl53Ceg/viewform?usp=header",
  },
  partOneAttendance: {
    label: "1부 현장 출석체크",
    url: "https://docs.google.com/forms/d/e/1FAIpQLScjxd-AIBNEwoGMwgXEMn78jZkddNz1S_gLyN8WdkF4EsE73Q/viewform",
  },
} as const;

export type EventExternalFormKey = keyof typeof EVENT_EXTERNAL_FORMS;
