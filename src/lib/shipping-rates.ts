export type ShippingRateBand = { maxGrams: number; thbMinor: number };

// Shop charges supplied by the owner, not a live carrier quotation.
export const DOMESTIC_EMS_RATES: readonly ShippingRateBand[] = [
  { maxGrams: 20, thbMinor: 3500 },
  { maxGrams: 100, thbMinor: 5000 },
  { maxGrams: 500, thbMinor: 7000 },
  { maxGrams: 1000, thbMinor: 8000 },
  { maxGrams: 2000, thbMinor: 10000 },
];

export const SHIPPING_MAX_GRAMS = 2000;
export const EPACKET_SOURCE_DATE = "2022-04-15";
export const EPACKET_ZONES: Record<string,number> = {"AU":4,"AT":8,"BE":9,"BT":1,"BR":9,"KH":1,"CA":6,"CN":1,"HR":8,"DK":9,"EE":7,"FI":8,"FR":4,"DE":3,"GR":9,"HK":1,"HU":7,"IN":1,"ID":1,"IT":8,"JP":1,"KR":1,"LA":1,"LU":8,"MY":1,"MV":1,"NL":9,"NZ":5,"NO":9,"PH":1,"PL":7,"PT":9,"RO":6,"RU":4,"SG":1,"SK":9,"SI":9,"ZA":7,"ES":6,"SE":6,"CH":9,"TW":1,"TR":8,"AE":2,"GB":3,"US":10,"VN":1};
const EPACKET_TARIFFS = [[160,160,200,220,225,260,260,260,260,285],[195,195,255,275,295,325,325,325,325,370],[240,235,310,330,365,390,390,390,390,455],[285,310,365,385,440,455,455,455,490,545],[330,380,420,440,510,520,520,535,610,630],[370,450,470,490,580,585,585,635,725,715],[410,525,520,550,650,650,655,740,840,800],[450,595,570,605,725,715,745,840,960,890],[490,665,620,665,795,780,835,945,1075,975],[530,740,670,720,865,845,930,1045,1195,1060],[565,810,720,780,940,910,1020,1150,1310,1150],[600,880,770,835,1010,975,1110,1250,1430,1235],[635,955,820,890,1080,1050,1200,1355,1545,1320],[675,1025,870,950,1150,1130,1290,1455,1660,1410],[720,1095,920,1005,1225,1210,1380,1555,1780,1495],[760,1170,965,1065,1295,1290,1470,1660,1895,1580],[800,1240,1010,1120,1365,1370,1560,1760,2015,1665],[840,1310,1055,1180,1440,1445,1655,1865,2130,1755],[885,1385,1100,1235,1510,1525,1745,1965,2245,1840],[925,1455,1145,1295,1580,1605,1835,2070,2365,1925]];

export function shopEmsRates(country: string): ShippingRateBand[] {
  if (!/^[A-Z]{2}$/.test(country)) throw Error('invalid_shipping_country');
  if (country === 'TH') return DOMESTIC_EMS_RATES.map(band => ({ ...band }));
  const zone = Object.hasOwn(EPACKET_ZONES, country) ? EPACKET_ZONES[country] : undefined;
  if (!zone) throw Error('shipping_destination_unavailable');
  return EPACKET_TARIFFS.map((row, index) => ({ maxGrams: (index + 1) * 100, thbMinor: row[zone - 1] * 100 }));
}
