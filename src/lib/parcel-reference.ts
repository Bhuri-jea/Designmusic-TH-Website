// Supplied Thailand Post table, effective 15 April 2022. Preparation reference only.
// This is neither a current quote nor shipping eligibility; never used by checkout.
const zones:Record<string,number>={AU:4,AT:8,BE:9,BT:1,BR:9,KH:1,CA:6,CN:1,HR:8,DK:9,EE:7,FI:8,FR:4,DE:3,GR:9,HK:1,HU:7,IN:1,ID:1,IT:8,JP:1,KR:1,LA:1,LU:8,MY:1,MV:1,NL:9,NZ:5,NO:9,PH:1,PL:7,PT:9,RO:6,RU:4,SG:1,SK:9,SI:9,ZA:7,ES:6,SE:6,CH:9,TW:1,TR:8,AE:2,GB:3,US:10,VN:1};
const amounts=[635,955,820,890,1080,1050,1200,1355,1545,1320];
export function historicalParcelReference(country:string){const zone=Object.hasOwn(zones,country)?zones[country]:undefined;return zone?{effectiveDate:'2022-04-15',assumedGrams:1300,zone,amountTHB:amounts[zone-1]}:null;}
