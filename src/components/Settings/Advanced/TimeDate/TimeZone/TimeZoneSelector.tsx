import { useCallback, useEffect, useState, useRef, useMemo } from 'react';
import { Swiper, SwiperSlide } from 'swiper/react';

import { useHandleGestures } from '../../../../../hooks/useHandleGestures';
import { useAppSelector, useAppDispatch } from '../../../../store/hooks';
import { setBubbleDisplay } from '../../../../store/features/screens/screens-slice';
import { marqueeIfNeeded } from '../../../../shared/MarqueeValue';
import { SettingsKey } from '@meticulous-home/espresso-api';
import { SettingsItem } from '../../../../../types';

type TimezoneData = {
  [country: string]: {
    [city: string]: string;
  };
};

const MOCK_TZ_JSON: TimezoneData = {
  "Côte d'Ivoire": { Abidjan: 'Africa/Abidjan' },
  Ghana: { Accra: 'Africa/Accra' },
  Ethiopia: { 'Addis Ababa': 'Africa/Addis_Ababa' },
  Algeria: { Algiers: 'Africa/Algiers' },
  Eritrea: { Asmara: 'Africa/Asmara' },
  LINKS: {
    Asmera: 'Africa/Asmera',
    Timbuktu: 'Africa/Timbuktu',
    'Argentina - ComodRivadavia': 'America/Argentina/ComodRivadavia',
    Atka: 'America/Atka',
    'Buenos Aires': 'America/Buenos_Aires',
    Catamarca: 'America/Catamarca',
    'Coral Harbour': 'America/Coral_Harbour',
    Cordoba: 'America/Cordoba',
    Ensenada: 'America/Ensenada',
    'Fort Wayne': 'America/Fort_Wayne',
    Godthab: 'America/Godthab',
    Indianapolis: 'America/Indianapolis',
    Jujuy: 'America/Jujuy',
    'Knox IN': 'America/Knox_IN',
    Louisville: 'America/Louisville',
    Mendoza: 'America/Mendoza',
    Montreal: 'America/Montreal',
    Nipigon: 'America/Nipigon',
    Pangnirtung: 'America/Pangnirtung',
    'Porto Acre': 'America/Porto_Acre',
    'Rainy River': 'America/Rainy_River',
    Rosario: 'America/Rosario',
    'Santa Isabel': 'America/Santa_Isabel',
    Shiprock: 'America/Shiprock',
    'Thunder Bay': 'America/Thunder_Bay',
    Virgin: 'America/Virgin',
    Yellowknife: 'America/Yellowknife',
    'South Pole': 'Antarctica/South_Pole',
    Ashkhabad: 'Asia/Ashkhabad',
    Calcutta: 'Asia/Calcutta',
    Chongqing: 'Asia/Chongqing',
    Chungking: 'Asia/Chungking',
    Dacca: 'Asia/Dacca',
    Harbin: 'Asia/Harbin',
    Istanbul: 'Asia/Istanbul',
    Kashgar: 'Asia/Kashgar',
    Katmandu: 'Asia/Katmandu',
    Macao: 'Asia/Macao',
    Rangoon: 'Asia/Rangoon',
    Saigon: 'Asia/Saigon',
    'Tel Aviv': 'Asia/Tel_Aviv',
    Thimbu: 'Asia/Thimbu',
    'Ujung Pandang': 'Asia/Ujung_Pandang',
    'Ulan Bator': 'Asia/Ulan_Bator',
    Faeroe: 'Atlantic/Faeroe',
    'Jan Mayen': 'Atlantic/Jan_Mayen',
    ACT: 'Australia/ACT',
    Canberra: 'Australia/Canberra',
    Currie: 'Australia/Currie',
    LHI: 'Australia/LHI',
    NSW: 'Australia/NSW',
    North: 'Australia/North',
    Queensland: 'Australia/Queensland',
    South: 'Australia/South',
    Tasmania: 'Australia/Tasmania',
    Victoria: 'Australia/Victoria',
    West: 'Brazil/West',
    Yancowinna: 'Australia/Yancowinna',
    Acre: 'Brazil/Acre',
    DeNoronha: 'Brazil/DeNoronha',
    East: 'Brazil/East',
    CET: 'CET',
    CST6CDT: 'CST6CDT',
    Atlantic: 'Canada/Atlantic',
    Central: 'US/Central',
    Eastern: 'US/Eastern',
    Mountain: 'US/Mountain',
    Newfoundland: 'Canada/Newfoundland',
    Pacific: 'US/Pacific',
    Saskatchewan: 'Canada/Saskatchewan',
    Yukon: 'Canada/Yukon',
    Continental: 'Chile/Continental',
    EasterIsland: 'Chile/EasterIsland',
    Cuba: 'Cuba',
    EET: 'EET',
    EST: 'EST',
    EST5EDT: 'EST5EDT',
    Egypt: 'Egypt',
    Eire: 'Eire',
    Belfast: 'Europe/Belfast',
    Kiev: 'Europe/Kiev',
    Nicosia: 'Europe/Nicosia',
    Tiraspol: 'Europe/Tiraspol',
    Uzhgorod: 'Europe/Uzhgorod',
    Zaporozhye: 'Europe/Zaporozhye',
    Factory: 'Factory',
    GB: 'GB',
    'GB-Eire': 'GB-Eire',
    GMT: 'GMT',
    'GMT+0': 'GMT+0',
    'GMT-0': 'GMT-0',
    GMT0: 'GMT0',
    Greenwich: 'Greenwich',
    HST: 'HST',
    Hongkong: 'Hongkong',
    Iceland: 'Iceland',
    Iran: 'Iran',
    Israel: 'Israel',
    Jamaica: 'Jamaica',
    Japan: 'Japan',
    Kwajalein: 'Kwajalein',
    Libya: 'Libya',
    MET: 'MET',
    MST: 'MST',
    MST7MDT: 'MST7MDT',
    BajaNorte: 'Mexico/BajaNorte',
    BajaSur: 'Mexico/BajaSur',
    General: 'Mexico/General',
    NZ: 'NZ',
    'NZ-CHAT': 'NZ-CHAT',
    Navajo: 'Navajo',
    PRC: 'PRC',
    PST8PDT: 'PST8PDT',
    Enderbury: 'Pacific/Enderbury',
    Johnston: 'Pacific/Johnston',
    Ponape: 'Pacific/Ponape',
    Samoa: 'US/Samoa',
    Truk: 'Pacific/Truk',
    Yap: 'Pacific/Yap',
    Poland: 'Poland',
    Portugal: 'Portugal',
    ROC: 'ROC',
    ROK: 'ROK',
    Singapore: 'Singapore',
    Turkey: 'Turkey',
    UCT: 'UCT',
    Alaska: 'US/Alaska',
    Aleutian: 'US/Aleutian',
    Arizona: 'US/Arizona',
    'East-Indiana': 'US/East-Indiana',
    Hawaii: 'US/Hawaii',
    'Indiana-Starke': 'US/Indiana-Starke',
    Michigan: 'US/Michigan',
    UTC: 'UTC',
    Universal: 'Universal',
    'W-SU': 'W-SU',
    WET: 'WET',
    Zulu: 'Zulu'
  },
  Mali: { Bamako: 'Africa/Bamako' },
  'Central African Rep.': { Bangui: 'Africa/Bangui' },
  Gambia: { Banjul: 'Africa/Banjul' },
  'Guinea-Bissau': { Bissau: 'Africa/Bissau' },
  Malawi: { Blantyre: 'Africa/Blantyre' },
  'Congo (Rep.)': { Brazzaville: 'Africa/Brazzaville' },
  Burundi: { Bujumbura: 'Africa/Bujumbura' },
  Egypt: { Cairo: 'Africa/Cairo' },
  Morocco: { Casablanca: 'Africa/Casablanca' },
  Spain: {
    Ceuta: 'Africa/Ceuta',
    Canary: 'Atlantic/Canary',
    Madrid: 'Europe/Madrid'
  },
  Guinea: { Conakry: 'Africa/Conakry' },
  Senegal: { Dakar: 'Africa/Dakar' },
  Tanzania: { 'Dar es Salaam': 'Africa/Dar_es_Salaam' },
  Djibouti: { Djibouti: 'Africa/Djibouti' },
  Cameroon: { Douala: 'Africa/Douala' },
  'Western Sahara': { 'El Aaiun': 'Africa/El_Aaiun' },
  'Sierra Leone': { Freetown: 'Africa/Freetown' },
  Botswana: { Gaborone: 'Africa/Gaborone' },
  Zimbabwe: { Harare: 'Africa/Harare' },
  'South Africa': { Johannesburg: 'Africa/Johannesburg' },
  'South Sudan': { Juba: 'Africa/Juba' },
  Uganda: { Kampala: 'Africa/Kampala' },
  Sudan: { Khartoum: 'Africa/Khartoum' },
  Rwanda: { Kigali: 'Africa/Kigali' },
  'Congo (Dem. Rep.)': {
    Kinshasa: 'Africa/Kinshasa',
    Lubumbashi: 'Africa/Lubumbashi'
  },
  Nigeria: { Lagos: 'Africa/Lagos' },
  Gabon: { Libreville: 'Africa/Libreville' },
  Togo: { Lome: 'Africa/Lome' },
  Angola: { Luanda: 'Africa/Luanda' },
  Zambia: { Lusaka: 'Africa/Lusaka' },
  'Equatorial Guinea': { Malabo: 'Africa/Malabo' },
  Mozambique: { Maputo: 'Africa/Maputo' },
  Lesotho: { Maseru: 'Africa/Maseru' },
  'Eswatini (Swaziland)': { Mbabane: 'Africa/Mbabane' },
  Somalia: { Mogadishu: 'Africa/Mogadishu' },
  Liberia: { Monrovia: 'Africa/Monrovia' },
  Kenya: { Nairobi: 'Africa/Nairobi' },
  Chad: { Ndjamena: 'Africa/Ndjamena' },
  Niger: { Niamey: 'Africa/Niamey' },
  Mauritania: { Nouakchott: 'Africa/Nouakchott' },
  'Burkina Faso': { Ouagadougou: 'Africa/Ouagadougou' },
  Benin: { 'Porto-Novo': 'Africa/Porto-Novo' },
  'Sao Tome & Principe': { 'Sao Tome': 'Africa/Sao_Tome' },
  Libya: { Tripoli: 'Africa/Tripoli' },
  Tunisia: { Tunis: 'Africa/Tunis' },
  Namibia: { Windhoek: 'Africa/Windhoek' },
  'United States': {
    Adak: 'America/Adak',
    Anchorage: 'America/Anchorage',
    Boise: 'America/Boise',
    Chicago: 'America/Chicago',
    Denver: 'America/Denver',
    Detroit: 'America/Detroit',
    'Indiana - Indianapolis': 'America/Indiana/Indianapolis',
    'Indiana - Knox': 'America/Indiana/Knox',
    'Indiana - Marengo': 'America/Indiana/Marengo',
    'Indiana - Petersburg': 'America/Indiana/Petersburg',
    'Indiana - Tell City': 'America/Indiana/Tell_City',
    'Indiana - Vevay': 'America/Indiana/Vevay',
    'Indiana - Vincennes': 'America/Indiana/Vincennes',
    'Indiana - Winamac': 'America/Indiana/Winamac',
    Juneau: 'America/Juneau',
    'Kentucky - Louisville': 'America/Kentucky/Louisville',
    'Kentucky - Monticello': 'America/Kentucky/Monticello',
    'Los Angeles': 'America/Los_Angeles',
    Menominee: 'America/Menominee',
    Metlakatla: 'America/Metlakatla',
    'New York': 'America/New_York',
    Nome: 'America/Nome',
    'North Dakota - Beulah': 'America/North_Dakota/Beulah',
    'North Dakota - Center': 'America/North_Dakota/Center',
    'North Dakota - New Salem': 'America/North_Dakota/New_Salem',
    Phoenix: 'America/Phoenix',
    Sitka: 'America/Sitka',
    Yakutat: 'America/Yakutat',
    Honolulu: 'Pacific/Honolulu'
  },
  Anguilla: { Anguilla: 'America/Anguilla' },
  'Antigua & Barbuda': { Antigua: 'America/Antigua' },
  Brazil: {
    Araguaina: 'America/Araguaina',
    Bahia: 'America/Bahia',
    Belem: 'America/Belem',
    'Boa Vista': 'America/Boa_Vista',
    'Campo Grande': 'America/Campo_Grande',
    Cuiaba: 'America/Cuiaba',
    Eirunepe: 'America/Eirunepe',
    Fortaleza: 'America/Fortaleza',
    Maceio: 'America/Maceio',
    Manaus: 'America/Manaus',
    Noronha: 'America/Noronha',
    'Porto Velho': 'America/Porto_Velho',
    Recife: 'America/Recife',
    'Rio Branco': 'America/Rio_Branco',
    Santarem: 'America/Santarem',
    'Sao Paulo': 'America/Sao_Paulo'
  },
  Argentina: {
    'Buenos Aires': 'America/Argentina/Buenos_Aires',
    Catamarca: 'America/Argentina/Catamarca',
    Cordoba: 'America/Argentina/Cordoba',
    Jujuy: 'America/Argentina/Jujuy',
    'La Rioja': 'America/Argentina/La_Rioja',
    Mendoza: 'America/Argentina/Mendoza',
    'Rio Gallegos': 'America/Argentina/Rio_Gallegos',
    Salta: 'America/Argentina/Salta',
    'San Juan': 'America/Argentina/San_Juan',
    'San Luis': 'America/Argentina/San_Luis',
    Tucuman: 'America/Argentina/Tucuman',
    Ushuaia: 'America/Argentina/Ushuaia'
  },
  Aruba: { Aruba: 'America/Aruba' },
  Paraguay: { Asuncion: 'America/Asuncion' },
  Canada: {
    Atikokan: 'America/Atikokan',
    'Blanc-Sablon': 'America/Blanc-Sablon',
    'Cambridge Bay': 'America/Cambridge_Bay',
    Creston: 'America/Creston',
    Dawson: 'America/Dawson',
    'Dawson Creek': 'America/Dawson_Creek',
    Edmonton: 'America/Edmonton',
    'Fort Nelson': 'America/Fort_Nelson',
    'Glace Bay': 'America/Glace_Bay',
    'Goose Bay': 'America/Goose_Bay',
    Halifax: 'America/Halifax',
    Inuvik: 'America/Inuvik',
    Iqaluit: 'America/Iqaluit',
    Moncton: 'America/Moncton',
    'Rankin Inlet': 'America/Rankin_Inlet',
    Regina: 'America/Regina',
    Resolute: 'America/Resolute',
    'St Johns': 'America/St_Johns',
    'Swift Current': 'America/Swift_Current',
    Toronto: 'America/Toronto',
    Vancouver: 'America/Vancouver',
    Whitehorse: 'America/Whitehorse',
    Winnipeg: 'America/Winnipeg'
  },
  Mexico: {
    'Bahia Banderas': 'America/Bahia_Banderas',
    Cancun: 'America/Cancun',
    Chihuahua: 'America/Chihuahua',
    'Ciudad Juarez': 'America/Ciudad_Juarez',
    Hermosillo: 'America/Hermosillo',
    Matamoros: 'America/Matamoros',
    Mazatlan: 'America/Mazatlan',
    Merida: 'America/Merida',
    'Mexico City': 'America/Mexico_City',
    Monterrey: 'America/Monterrey',
    Ojinaga: 'America/Ojinaga',
    Tijuana: 'America/Tijuana'
  },
  Barbados: { Barbados: 'America/Barbados' },
  Belize: { Belize: 'America/Belize' },
  Colombia: { Bogota: 'America/Bogota' },
  Venezuela: { Caracas: 'America/Caracas' },
  'French Guiana': { Cayenne: 'America/Cayenne' },
  'Cayman Islands': { Cayman: 'America/Cayman' },
  'Costa Rica': { 'Costa Rica': 'America/Costa_Rica' },
  Curaçao: { Curacao: 'America/Curacao' },
  Greenland: {
    Danmarkshavn: 'America/Danmarkshavn',
    Nuuk: 'America/Nuuk',
    Scoresbysund: 'America/Scoresbysund',
    Thule: 'America/Thule'
  },
  Dominica: { Dominica: 'America/Dominica' },
  'El Salvador': { 'El Salvador': 'America/El_Salvador' },
  'Turks & Caicos Is': { 'Grand Turk': 'America/Grand_Turk' },
  Grenada: { Grenada: 'America/Grenada' },
  Guadeloupe: { Guadeloupe: 'America/Guadeloupe' },
  Guatemala: { Guatemala: 'America/Guatemala' },
  Ecuador: { Guayaquil: 'America/Guayaquil', Galapagos: 'Pacific/Galapagos' },
  Guyana: { Guyana: 'America/Guyana' },
  Cuba: { Havana: 'America/Havana' },
  Jamaica: { Jamaica: 'America/Jamaica' },
  'Caribbean NL': { Kralendijk: 'America/Kralendijk' },
  Bolivia: { 'La Paz': 'America/La_Paz' },
  Peru: { Lima: 'America/Lima' },
  'St Maarten (Dutch)': { 'Lower Princes': 'America/Lower_Princes' },
  Nicaragua: { Managua: 'America/Managua' },
  'St Martin (French)': { Marigot: 'America/Marigot' },
  Martinique: { Martinique: 'America/Martinique' },
  'St Pierre & Miquelon': { Miquelon: 'America/Miquelon' },
  Uruguay: { Montevideo: 'America/Montevideo' },
  Montserrat: { Montserrat: 'America/Montserrat' },
  Bahamas: { Nassau: 'America/Nassau' },
  Panama: { Panama: 'America/Panama' },
  Suriname: { Paramaribo: 'America/Paramaribo' },
  Haiti: { 'Port-au-Prince': 'America/Port-au-Prince' },
  'Trinidad & Tobago': { 'Port of Spain': 'America/Port_of_Spain' },
  'Puerto Rico': { 'Puerto Rico': 'America/Puerto_Rico' },
  Chile: {
    'Punta Arenas': 'America/Punta_Arenas',
    Santiago: 'America/Santiago',
    Easter: 'Pacific/Easter'
  },
  'Dominican Republic': { 'Santo Domingo': 'America/Santo_Domingo' },
  'St Barthelemy': { 'St Barthelemy': 'America/St_Barthelemy' },
  'St Kitts & Nevis': { 'St Kitts': 'America/St_Kitts' },
  'St Lucia': { 'St Lucia': 'America/St_Lucia' },
  'Virgin Islands (US)': { 'St Thomas': 'America/St_Thomas' },
  'St Vincent': { 'St Vincent': 'America/St_Vincent' },
  Honduras: { Tegucigalpa: 'America/Tegucigalpa' },
  'Virgin Islands (UK)': { Tortola: 'America/Tortola' },
  Antarctica: {
    Casey: 'Antarctica/Casey',
    Davis: 'Antarctica/Davis',
    DumontDUrville: 'Antarctica/DumontDUrville',
    Mawson: 'Antarctica/Mawson',
    McMurdo: 'Antarctica/McMurdo',
    Palmer: 'Antarctica/Palmer',
    Rothera: 'Antarctica/Rothera',
    Syowa: 'Antarctica/Syowa',
    Troll: 'Antarctica/Troll',
    Vostok: 'Antarctica/Vostok'
  },
  Australia: {
    Macquarie: 'Antarctica/Macquarie',
    Adelaide: 'Australia/Adelaide',
    Brisbane: 'Australia/Brisbane',
    'Broken Hill': 'Australia/Broken_Hill',
    Darwin: 'Australia/Darwin',
    Eucla: 'Australia/Eucla',
    Hobart: 'Australia/Hobart',
    Lindeman: 'Australia/Lindeman',
    'Lord Howe': 'Australia/Lord_Howe',
    Melbourne: 'Australia/Melbourne',
    Perth: 'Australia/Perth',
    Sydney: 'Australia/Sydney'
  },
  'Svalbard & Jan Mayen': { Longyearbyen: 'Arctic/Longyearbyen' },
  Yemen: { Aden: 'Asia/Aden' },
  Kazakhstan: {
    Almaty: 'Asia/Almaty',
    Aqtau: 'Asia/Aqtau',
    Aqtobe: 'Asia/Aqtobe',
    Atyrau: 'Asia/Atyrau',
    Oral: 'Asia/Oral',
    Qostanay: 'Asia/Qostanay',
    Qyzylorda: 'Asia/Qyzylorda'
  },
  Jordan: { Amman: 'Asia/Amman' },
  Russia: {
    Anadyr: 'Asia/Anadyr',
    Barnaul: 'Asia/Barnaul',
    Chita: 'Asia/Chita',
    Irkutsk: 'Asia/Irkutsk',
    Kamchatka: 'Asia/Kamchatka',
    Khandyga: 'Asia/Khandyga',
    Krasnoyarsk: 'Asia/Krasnoyarsk',
    Magadan: 'Asia/Magadan',
    Novokuznetsk: 'Asia/Novokuznetsk',
    Novosibirsk: 'Asia/Novosibirsk',
    Omsk: 'Asia/Omsk',
    Sakhalin: 'Asia/Sakhalin',
    Srednekolymsk: 'Asia/Srednekolymsk',
    Tomsk: 'Asia/Tomsk',
    'Ust-Nera': 'Asia/Ust-Nera',
    Vladivostok: 'Asia/Vladivostok',
    Yakutsk: 'Asia/Yakutsk',
    Yekaterinburg: 'Asia/Yekaterinburg',
    Astrakhan: 'Europe/Astrakhan',
    Kaliningrad: 'Europe/Kaliningrad',
    Kirov: 'Europe/Kirov',
    Moscow: 'Europe/Moscow',
    Samara: 'Europe/Samara',
    Saratov: 'Europe/Saratov',
    Ulyanovsk: 'Europe/Ulyanovsk',
    Volgograd: 'Europe/Volgograd'
  },
  Turkmenistan: { Ashgabat: 'Asia/Ashgabat' },
  Iraq: { Baghdad: 'Asia/Baghdad' },
  Bahrain: { Bahrain: 'Asia/Bahrain' },
  Azerbaijan: { Baku: 'Asia/Baku' },
  Thailand: { Bangkok: 'Asia/Bangkok' },
  Lebanon: { Beirut: 'Asia/Beirut' },
  Kyrgyzstan: { Bishkek: 'Asia/Bishkek' },
  Brunei: { Brunei: 'Asia/Brunei' },
  Mongolia: {
    Choibalsan: 'Asia/Choibalsan',
    Hovd: 'Asia/Hovd',
    Ulaanbaatar: 'Asia/Ulaanbaatar'
  },
  'Sri Lanka': { Colombo: 'Asia/Colombo' },
  Syria: { Damascus: 'Asia/Damascus' },
  Bangladesh: { Dhaka: 'Asia/Dhaka' },
  'East Timor': { Dili: 'Asia/Dili' },
  'United Arab Emirates': { Dubai: 'Asia/Dubai' },
  Tajikistan: { Dushanbe: 'Asia/Dushanbe' },
  Cyprus: { Famagusta: 'Asia/Famagusta', Nicosia: 'Asia/Nicosia' },
  Palestine: { Gaza: 'Asia/Gaza', Hebron: 'Asia/Hebron' },
  Vietnam: { 'Ho Chi Minh': 'Asia/Ho_Chi_Minh' },
  'Hong Kong': { 'Hong Kong': 'Asia/Hong_Kong' },
  Indonesia: {
    Jakarta: 'Asia/Jakarta',
    Jayapura: 'Asia/Jayapura',
    Makassar: 'Asia/Makassar',
    Pontianak: 'Asia/Pontianak'
  },
  Israel: { Jerusalem: 'Asia/Jerusalem' },
  Afghanistan: { Kabul: 'Asia/Kabul' },
  Pakistan: { Karachi: 'Asia/Karachi' },
  Nepal: { Kathmandu: 'Asia/Kathmandu' },
  India: { Kolkata: 'Asia/Kolkata' },
  Malaysia: { 'Kuala Lumpur': 'Asia/Kuala_Lumpur', Kuching: 'Asia/Kuching' },
  Kuwait: { Kuwait: 'Asia/Kuwait' },
  Macau: { Macau: 'Asia/Macau' },
  Philippines: { Manila: 'Asia/Manila' },
  Oman: { Muscat: 'Asia/Muscat' },
  Cambodia: { 'Phnom Penh': 'Asia/Phnom_Penh' },
  'Korea (North)': { Pyongyang: 'Asia/Pyongyang' },
  Qatar: { Qatar: 'Asia/Qatar' },
  'Saudi Arabia': { Riyadh: 'Asia/Riyadh' },
  Uzbekistan: { Samarkand: 'Asia/Samarkand', Tashkent: 'Asia/Tashkent' },
  'Korea (South)': { Seoul: 'Asia/Seoul' },
  China: { Shanghai: 'Asia/Shanghai', Urumqi: 'Asia/Urumqi' },
  Singapore: { Singapore: 'Asia/Singapore' },
  Taiwan: { Taipei: 'Asia/Taipei' },
  Georgia: { Tbilisi: 'Asia/Tbilisi' },
  Iran: { Tehran: 'Asia/Tehran' },
  Bhutan: { Thimphu: 'Asia/Thimphu' },
  Japan: { Tokyo: 'Asia/Tokyo' },
  Laos: { Vientiane: 'Asia/Vientiane' },
  'Myanmar (Burma)': { Yangon: 'Asia/Yangon' },
  Armenia: { Yerevan: 'Asia/Yerevan' },
  Portugal: {
    Azores: 'Atlantic/Azores',
    Madeira: 'Atlantic/Madeira',
    Lisbon: 'Europe/Lisbon'
  },
  Bermuda: { Bermuda: 'Atlantic/Bermuda' },
  'Cape Verde': { 'Cape Verde': 'Atlantic/Cape_Verde' },
  'Faroe Islands': { Faroe: 'Atlantic/Faroe' },
  Iceland: { Reykjavik: 'Atlantic/Reykjavik' },
  'South Georgia & the South Sandwich Islands': {
    'South Georgia': 'Atlantic/South_Georgia'
  },
  'St Helena': { 'St Helena': 'Atlantic/St_Helena' },
  'Falkland Islands': { Stanley: 'Atlantic/Stanley' },
  ETC: {
    GMT: 'Etc/GMT',
    'GMT+0': 'Etc/GMT+0',
    'GMT+1': 'Etc/GMT+1',
    'GMT+10': 'Etc/GMT+10',
    'GMT+11': 'Etc/GMT+11',
    'GMT+12': 'Etc/GMT+12',
    'GMT+2': 'Etc/GMT+2',
    'GMT+3': 'Etc/GMT+3',
    'GMT+4': 'Etc/GMT+4',
    'GMT+5': 'Etc/GMT+5',
    'GMT+6': 'Etc/GMT+6',
    'GMT+7': 'Etc/GMT+7',
    'GMT+8': 'Etc/GMT+8',
    'GMT+9': 'Etc/GMT+9',
    'GMT-0': 'Etc/GMT-0',
    'GMT-1': 'Etc/GMT-1',
    'GMT-10': 'Etc/GMT-10',
    'GMT-11': 'Etc/GMT-11',
    'GMT-12': 'Etc/GMT-12',
    'GMT-13': 'Etc/GMT-13',
    'GMT-14': 'Etc/GMT-14',
    'GMT-2': 'Etc/GMT-2',
    'GMT-3': 'Etc/GMT-3',
    'GMT-4': 'Etc/GMT-4',
    'GMT-5': 'Etc/GMT-5',
    'GMT-6': 'Etc/GMT-6',
    'GMT-7': 'Etc/GMT-7',
    'GMT-8': 'Etc/GMT-8',
    'GMT-9': 'Etc/GMT-9',
    GMT0: 'Etc/GMT0',
    Greenwich: 'Etc/Greenwich',
    UCT: 'Etc/UCT',
    UTC: 'Etc/UTC',
    Universal: 'Etc/Universal',
    Zulu: 'Etc/Zulu'
  },
  Netherlands: { Amsterdam: 'Europe/Amsterdam' },
  Andorra: { Andorra: 'Europe/Andorra' },
  Greece: { Athens: 'Europe/Athens' },
  Serbia: { Belgrade: 'Europe/Belgrade' },
  Germany: { Berlin: 'Europe/Berlin', Busingen: 'Europe/Busingen' },
  Slovakia: { Bratislava: 'Europe/Bratislava' },
  Belgium: { Brussels: 'Europe/Brussels' },
  Romania: { Bucharest: 'Europe/Bucharest' },
  Hungary: { Budapest: 'Europe/Budapest' },
  Moldova: { Chisinau: 'Europe/Chisinau' },
  Denmark: { Copenhagen: 'Europe/Copenhagen' },
  Ireland: { Dublin: 'Europe/Dublin' },
  Gibraltar: { Gibraltar: 'Europe/Gibraltar' },
  Guernsey: { Guernsey: 'Europe/Guernsey' },
  Finland: { Helsinki: 'Europe/Helsinki' },
  'Isle of Man': { 'Isle of Man': 'Europe/Isle_of_Man' },
  Turkey: { Istanbul: 'Europe/Istanbul' },
  Jersey: { Jersey: 'Europe/Jersey' },
  Ukraine: { Kyiv: 'Europe/Kyiv', Simferopol: 'Europe/Simferopol' },
  Slovenia: { Ljubljana: 'Europe/Ljubljana' },
  'Britain (UK)': { London: 'Europe/London' },
  Luxembourg: { Luxembourg: 'Europe/Luxembourg' },
  Malta: { Malta: 'Europe/Malta' },
  'Åland Islands': { Mariehamn: 'Europe/Mariehamn' },
  Belarus: { Minsk: 'Europe/Minsk' },
  Monaco: { Monaco: 'Europe/Monaco' },
  Norway: { Oslo: 'Europe/Oslo' },
  France: { Paris: 'Europe/Paris' },
  Montenegro: { Podgorica: 'Europe/Podgorica' },
  'Czech Republic': { Prague: 'Europe/Prague' },
  Latvia: { Riga: 'Europe/Riga' },
  Italy: { Rome: 'Europe/Rome' },
  'San Marino': { 'San Marino': 'Europe/San_Marino' },
  'Bosnia & Herzegovina': { Sarajevo: 'Europe/Sarajevo' },
  'North Macedonia': { Skopje: 'Europe/Skopje' },
  Bulgaria: { Sofia: 'Europe/Sofia' },
  Sweden: { Stockholm: 'Europe/Stockholm' },
  Estonia: { Tallinn: 'Europe/Tallinn' },
  Albania: { Tirane: 'Europe/Tirane' },
  Liechtenstein: { Vaduz: 'Europe/Vaduz' },
  'Vatican City': { Vatican: 'Europe/Vatican' },
  Austria: { Vienna: 'Europe/Vienna' },
  Lithuania: { Vilnius: 'Europe/Vilnius' },
  Poland: { Warsaw: 'Europe/Warsaw' },
  Croatia: { Zagreb: 'Europe/Zagreb' },
  Switzerland: { Zurich: 'Europe/Zurich' },
  Madagascar: { Antananarivo: 'Indian/Antananarivo' },
  'British Indian Ocean Territory': { Chagos: 'Indian/Chagos' },
  'Christmas Island': { Christmas: 'Indian/Christmas' },
  'Cocos (Keeling) Islands': { Cocos: 'Indian/Cocos' },
  Comoros: { Comoro: 'Indian/Comoro' },
  'French S. Terr.': { Kerguelen: 'Indian/Kerguelen' },
  Seychelles: { Mahe: 'Indian/Mahe' },
  Maldives: { Maldives: 'Indian/Maldives' },
  Mauritius: { Mauritius: 'Indian/Mauritius' },
  Mayotte: { Mayotte: 'Indian/Mayotte' },
  Réunion: { Reunion: 'Indian/Reunion' },
  'Samoa (western)': { Apia: 'Pacific/Apia' },
  'New Zealand': { Auckland: 'Pacific/Auckland', Chatham: 'Pacific/Chatham' },
  'Papua New Guinea': {
    Bougainville: 'Pacific/Bougainville',
    'Port Moresby': 'Pacific/Port_Moresby'
  },
  Micronesia: {
    Chuuk: 'Pacific/Chuuk',
    Kosrae: 'Pacific/Kosrae',
    Pohnpei: 'Pacific/Pohnpei'
  },
  Vanuatu: { Efate: 'Pacific/Efate' },
  Tokelau: { Fakaofo: 'Pacific/Fakaofo' },
  Fiji: { Fiji: 'Pacific/Fiji' },
  Tuvalu: { Funafuti: 'Pacific/Funafuti' },
  'French Polynesia': {
    Gambier: 'Pacific/Gambier',
    Marquesas: 'Pacific/Marquesas',
    Tahiti: 'Pacific/Tahiti'
  },
  'Solomon Islands': { Guadalcanal: 'Pacific/Guadalcanal' },
  Guam: { Guam: 'Pacific/Guam' },
  Kiribati: {
    Kanton: 'Pacific/Kanton',
    Kiritimati: 'Pacific/Kiritimati',
    Tarawa: 'Pacific/Tarawa'
  },
  'Marshall Islands': {
    Kwajalein: 'Pacific/Kwajalein',
    Majuro: 'Pacific/Majuro'
  },
  'US minor outlying islands': {
    Midway: 'Pacific/Midway',
    Wake: 'Pacific/Wake'
  },
  Nauru: { Nauru: 'Pacific/Nauru' },
  Niue: { Niue: 'Pacific/Niue' },
  'Norfolk Island': { Norfolk: 'Pacific/Norfolk' },
  'New Caledonia': { Noumea: 'Pacific/Noumea' },
  'Samoa (American)': { 'Pago Pago': 'Pacific/Pago_Pago' },
  Palau: { Palau: 'Pacific/Palau' },
  Pitcairn: { Pitcairn: 'Pacific/Pitcairn' },
  'Cook Islands': { Rarotonga: 'Pacific/Rarotonga' },
  'Northern Mariana Islands': { Saipan: 'Pacific/Saipan' },
  Tonga: { Tongatapu: 'Pacific/Tongatapu' },
  'Wallis & Futuna': { Wallis: 'Pacific/Wallis' }
};

type ListOnDisplay = 'alphabet' | 'regions' | 'zones';

export const TimeZoneSelector = () => {
  const dispatch = useAppDispatch();
  const globalSettings = useAppSelector((state) => state.settings);
  const [swiper, setSwiper] = useState(null);
  const [activeIndex, setActiveIndex] = useState(1);
  const bubbleDisplay = useAppSelector((state) => state.screen.bubbleDisplay);
  const [currentListOnDisplay, setCurrentListOnDisplay] =
    useState<ListOnDisplay>('alphabet');
  const [timezonesJson, setTimezonesJson] = useState(MOCK_TZ_JSON);

  // to not disrupt user flow when clicking 'back'
  const lastSelectedLetter = useRef<string>('');
  const lastSelectedLetterIndex = useRef<number>(0);
  const lastCoutryIndex = useRef<number>(0);
  const lastCountrySelected = useRef<string>('');
  const alphabet = [...'abcdefghijklmnopqrstuvwxyz'];

  const [availableCountries, setAvailableCountries] = useState<string[]>([]);

  const get_alphabet_label = (letter: string) => {
    const filtered_countries = availableCountries.filter((country: string) => {
      return (
        country.toLocaleLowerCase().startsWith(letter) &&
        country !== 'LINKS' &&
        country !== 'ETC'
      );
    });
    console.log(letter, filtered_countries);
    return `${filtered_countries[0]} ${filtered_countries.length > 1 ? `... +${filtered_countries.length}` : ''}`;
    // return `${letter} | ${filtered_countries[0]} ${(filtered_countries.length > 1 )? ', ...':''}`
  };

  const BackOption: SettingsItem = {
    key: 'back',
    label: 'Back',
    visible: true
  };

  const defaultOptionsList: SettingsItem[] = useMemo(
    () => [
      BackOption,
      ...alphabet.map((key) => ({
        key: key,
        label: get_alphabet_label(key),
        visible: true
      }))
    ],
    [availableCountries]
  );

  // mounts the component with the alphabet
  const [optionsList, setOptionsList] =
    useState<SettingsItem[]>(defaultOptionsList);

  //update the available countries when the json arrives
  useEffect(() => {
    setAvailableCountries(Object.keys(timezonesJson).sort());
  }, [timezonesJson]);

  useEffect(() => {
    if (currentListOnDisplay === 'alphabet') {
      setOptionsList(defaultOptionsList);
    }
  }, [availableCountries]);

  const onSelectLetter = (letter: string) => {
    const countryArray = availableCountries
      .filter((key: string) => {
        console.log(key.toLocaleLowerCase().startsWith(letter));
        return (
          key.toLocaleLowerCase().startsWith(letter) &&
          key !== 'LINKS' &&
          key !== 'ETC'
        );
      })
      .sort();
    lastSelectedLetter.current = letter;
    lastSelectedLetterIndex.current = activeIndex;

    setOptionsList([
      BackOption,
      ...countryArray.map((key) => ({
        key: key,
        label: key,
        visible: true
      }))
    ]);

    setActiveIndex(1);
    setCurrentListOnDisplay('regions');

    //Delete
    if (activeIndex > 2000) {
      setTimezonesJson({});
    }
  };

  const onSelectRegion = (region: string) => {
    console.log(region, timezonesJson[region]);
    const zonesArray = Object.keys(timezonesJson[region]).sort();

    lastCoutryIndex.current = activeIndex;
    lastCountrySelected.current = region;

    setOptionsList([
      BackOption,
      ...zonesArray.map((key) => ({
        key: key,
        label: key,
        visible: true
      }))
    ]);

    setActiveIndex(1);
    setCurrentListOnDisplay('zones');
  };

  const onSelectZone = (zone: string) => {
    const timeZoneSelected = timezonesJson[lastCountrySelected.current][zone];
    console.log(`setting timezone to ${timeZoneSelected}`);

    setActiveIndex(0);
    setCurrentListOnDisplay('alphabet');

    dispatch(setBubbleDisplay({ visible: true, component: 'timeDate' }));
  };

  const onSelectOption = (optionKey: string) => {
    switch (currentListOnDisplay) {
      case 'alphabet':
        onSelectLetter(optionKey);
        break;
      case 'regions':
        onSelectRegion(optionKey);
        break;
      case 'zones':
        onSelectZone(optionKey);
        break;
    }
  };

  const onBackOption = () => {
    switch (currentListOnDisplay) {
      case 'alphabet':
        dispatch(
          setBubbleDisplay({ visible: true, component: 'timeZoneConfig' })
        );
        break;
      case 'regions':
        setOptionsList(defaultOptionsList);
        setActiveIndex(lastSelectedLetterIndex.current);
        setCurrentListOnDisplay('alphabet');
        break;
      case 'zones':
        setOptionsList([
          BackOption,
          ...Object.keys(timezonesJson)
            .filter((key: string) => {
              console.log(
                key.toLocaleLowerCase().startsWith(lastSelectedLetter.current)
              );
              return (
                key
                  .toLocaleLowerCase()
                  .startsWith(lastSelectedLetter.current) &&
                key !== 'LINKS' &&
                key !== 'ETC'
              );
            })
            .sort()
            .map((key) => ({
              key: key,
              label: key,
              visible: true
            }))
        ]);
        // onSelectLetter(lastSelectedLetter.current)
        setActiveIndex(lastCoutryIndex.current);
        setCurrentListOnDisplay('regions');
        break;
    }
  };

  const showValue = useCallback(
    (isActive: boolean, item: SettingsItem) => {
      if (!item) return <></>;
      let val = item.label.toUpperCase();
      if (globalSettings) {
        if (typeof globalSettings[item.key as SettingsKey] === 'boolean') {
          val = globalSettings[item.key as SettingsKey]
            ? val + ': ENABLED'
            : val + ': DISABLED';
        }

        return marqueeIfNeeded({ enabled: isActive, val });
      }
    },
    [globalSettings]
  );

  useHandleGestures(
    {
      left() {
        setActiveIndex((prev) => Math.max(prev - 1, 0));
      },
      right() {
        setActiveIndex((prev) => Math.min(prev + 1, optionsList.length - 1));
      },
      pressDown() {
        const activeItem = optionsList[activeIndex].key;
        switch (activeItem) {
          case 'back':
            onBackOption();
            break;
          default: {
            onSelectOption(optionsList[activeIndex].key);
            break;
          }
        }
      }
    },
    !bubbleDisplay.visible
  );

  useEffect(() => {
    if (swiper) {
      swiper.slideTo(activeIndex, 0, false);
    }
  }, [activeIndex, swiper]);

  return (
    <div className="main-quick-settings">
      <Swiper
        onSwiper={setSwiper}
        slidesPerView={8}
        allowTouchMove={false}
        direction="vertical"
        spaceBetween={25}
        autoHeight={false}
        centeredSlides={true}
        initialSlide={activeIndex}
        style={{ paddingLeft: '29px', top: '-4px' }}
      >
        {optionsList.map((item, index: number) => {
          const isActive = index === activeIndex;
          return (
            <SwiperSlide
              key={index}
              className={`settings-item ${isActive ? 'active-setting' : ''}`}
              style={{ width: '100%' }}
            >
              <div style={{ height: '30px', width: '90%' }}>
                <div
                  className="settings-entry text-container"
                  style={{ display: 'flex', justifyContent: 'space-between' }}
                >
                  <span
                    className="settings-text"
                    style={{ wordBreak: 'break-word' }}
                  >
                    {showValue(isActive, item)}
                  </span>

                  {item.key !== 'back' && isActive ? (
                    <span>
                      <svg
                        xmlns="http://www.w3.org/2000/svg"
                        fill="none"
                        viewBox="0 0 24 24"
                        stroke-width="1.7"
                        stroke="currentColor"
                        style={{ width: '25px' }}
                      >
                        <path
                          stroke-linecap="round"
                          stroke-linejoin="round"
                          d="m19.5 8.25-7.5 7.5-7.5-7.5"
                        />
                      </svg>
                    </span>
                  ) : null}
                </div>
              </div>
            </SwiperSlide>
          );
        })}
      </Swiper>
    </div>
  );
};
