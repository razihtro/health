import { NextResponse } from "next/server"
import { GarminConnect } from "garmin-connect"
import { kv } from "@vercel/kv";
import { Session } from "garmin-connect/dist/garmin/GarminConnect";
import { cache } from "react";

export const revalidate = 120;
export const dynamic = 'force-dynamic';

type Respiration = {
  lastUpdated: number | null,
  userProfilePK: number | null;
  calendarDate: string,
  startTimestampGMT: string,
  endTimestampGMT: string,
  startTimestampLocal: string,
  endTimestampLocal: string,
  sleepStartTimestampGMT: string,
  sleepEndTimestampGMT: string,
  sleepStartTimestampLocal: string,
  sleepEndTimestampLocal: string,
  tomorrowSleepStartTimestampGMT: string,
  tomorrowSleepEndTimestampGMT: string,
  tomorrowSleepStartTimestampLocal: string,
  tomorrowSleepEndTimestampLocal: string,
  lowestRespirationValue: number,
  highestRespirationValue: number,
  avgWakingRespirationValue: number,
  avgSleepRespirationValue: number,
  avgTomorrowSleepRespirationValue: number,
  respirationValueDescriptorsDTOList: Array<Map<string, any>>,
  respirationValuesArray: Array<Map<number, number>>,
}

const getRespiration = cache(async () => {
  var GCClient = new GarminConnect({
    username: process.env.GARMIN_USERNAME ?? "",
    password: process.env.GARMIN_PASSWORD ?? "",
  })
  GCClient.onSessionChange(async (session) => {
    await kv.set('garmin_session', session);
  });
  GCClient = await GCClient.restoreOrLogin(await kv.get('garmin_session') as Session, process.env.GARMIN_USERNAME ?? "", process.env.GARMIN_PASSWORD ?? "");  const url =
    'https://connect.garmin.com/modern/proxy/wellness-service/wellness/daily/respiration/';
  try {
    var respiration = await GCClient.get(url + ((new Date(Date.now() - 1000 * 60 * 60 * 24)).toISOString().split('T')[0])) as Respiration;
    var respiration2 = await GCClient.get(url + ((new Date(Date.now())).toISOString().split('T')[0])) as Respiration;
    respiration.respirationValuesArray.push(...respiration2.respirationValuesArray);
    respiration.userProfilePK = null;
    // Only last 12 hours
    respiration.respirationValuesArray = respiration.respirationValuesArray.filter((value: any) => {
      return value[1] > 0 && value[0] > Date.now() - 1000 * 60 * 60 * 12;
    });
  } catch (error) {
    return null;
  }
  respiration.lastUpdated = Date.now().valueOf();
  return respiration;
})

export async function GET(request: Request) {
  var respiration = await getRespiration();
  
  if (respiration == null) {
    return NextResponse.json({}, { status: 500, headers: { 'Cache-Control': 'maxage=0, s-maxage=1, stale-while-revalidate' } })
  }

  return NextResponse.json({
    lastUpdated: respiration.lastUpdated,
    respirationValuesArray: respiration.respirationValuesArray,
  }, { status: 200, headers: { 'Cache-Control': 'maxage=0, s-maxage=120, stale-while-revalidate' } })
}
