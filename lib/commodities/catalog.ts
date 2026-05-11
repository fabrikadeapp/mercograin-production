/**
 * Catálogo de commodities futures para o widget "Real Time Commodity Futures Prices".
 *
 * Símbolos referenciam Yahoo Finance (yahoo-finance2). Convenções:
 *   - Suffix =F → futures continuous front month
 *   - Suffix =X → forex
 *   - Sem suffix → spot/index (ex.: ouro spot XAU/USD via 'XAUUSD=X' não existe;
 *     usamos 'GC=F' para ouro futures e 'XAUUSD=X' como spot quando disponível)
 *
 * Specification (contractSize, tickValue) preenchidas para os símbolos onde
 * essas informações são públicas e estáveis (CME, ICE). Para alguns símbolos
 * (LME, MATIF) o spec pode estar ausente até validação.
 */

export type CommodityCategory =
  | 'metals'
  | 'energy'
  | 'industrial_metals'
  | 'grains'
  | 'softs'
  | 'livestock'

export type CountryCode = 'US' | 'GB' | 'NL' | 'XX' // XX = supranational/LME

export interface CommodityDef {
  /** ID estável (slug). */
  id: string
  /** Símbolo Yahoo (com =F / =X). */
  symbol: string
  /** Root symbol (sem suffix, ex.: 'GC', 'ZS'). Usado na tab Specification. */
  rootSymbol?: string
  /** Nome exibido. */
  name: string
  category: CommodityCategory
  country: CountryCode
  /** Mês do contrato exibido como label (ex.: 'Jul 26'). Yahoo pode sobrescrever. */
  contractMonth?: string
  currency: string
  /** Unidade da cotação (ex.: 'USc/bu', 'USD/oz'). */
  unit: string
  /** Bolsa onde negocia. */
  exchange: string
  /** Tamanho do contrato (ex.: '5,000 bu', '100 oz'). Opcional. */
  contractSize?: string
  /** Calendário de vencimentos (ex.: 'HKNUZ' = Mar/Mai/Jul/Set/Dez). Opcional. */
  monthsCode?: string
  /** Tick mínimo. Opcional. */
  tick?: string
  /** Valor por ponto / "1 = $X". Opcional. */
  pointValue?: string
}

export const COMMODITIES: CommodityDef[] = [
  // ============ METAIS PRECIOSOS ============
  { id: 'gold',        symbol: 'GC=F',  rootSymbol: 'GC',    name: 'Gold',           category: 'metals',  country: 'US', currency: 'USD', unit: 'USD/oz',  exchange: 'COMEX', contractSize: '100 Troy Ounces',   monthsCode: 'GJMQVZ',       tick: '0.10',  pointValue: '1 = $100' },
  { id: 'xauusd',      symbol: 'GC=F',  rootSymbol: '-',     name: 'XAU/USD',        category: 'metals',  country: 'XX', currency: 'USD', unit: 'USD/oz',  exchange: 'OTC' },
  { id: 'silver',      symbol: 'SI=F',  rootSymbol: 'SI',    name: 'Silver',         category: 'metals',  country: 'US', currency: 'USD', unit: 'USD/oz',  exchange: 'COMEX', contractSize: '5,000 Troy Ounces', monthsCode: 'FHKUNZ',       tick: '0.005', pointValue: '1 = $5000' },
  { id: 'xagusd',      symbol: 'SI=F',  rootSymbol: '-',     name: 'XAG/USD',        category: 'metals',  country: 'XX', currency: 'USD', unit: 'USD/oz',  exchange: 'OTC' },
  { id: 'copper',      symbol: 'HG=F',  rootSymbol: 'HG',    name: 'Copper',         category: 'metals',  country: 'US', currency: 'USD', unit: 'USD/lb',  exchange: 'COMEX', contractSize: '25,000 Lbs.',       monthsCode: 'HKNUZ',        tick: '0.0005', pointValue: '1 = $25000' },
  { id: 'platinum',    symbol: 'PL=F',  rootSymbol: 'PL',    name: 'Platinum',       category: 'metals',  country: 'US', currency: 'USD', unit: 'USD/oz',  exchange: 'NYMEX', contractSize: '50 Troy Ounces',    monthsCode: 'FJNV',         tick: '0.10',  pointValue: '1 = $50' },
  { id: 'palladium',   symbol: 'PA=F',  rootSymbol: 'PA',    name: 'Palladium',      category: 'metals',  country: 'US', currency: 'USD', unit: 'USD/oz',  exchange: 'NYMEX', contractSize: '100 Troy Ounces',   monthsCode: 'HMUZ',         tick: '0.50',  pointValue: '1 = $100' },

  // ============ ENERGIA ============
  { id: 'wti',         symbol: 'CL=F',  rootSymbol: 'CL',    name: 'Crude Oil WTI',  category: 'energy',  country: 'US', currency: 'USD', unit: 'USD/bbl', exchange: 'ICE',   contractSize: '1,000 Barrels',     monthsCode: 'FGHJKMNQUVXZ', tick: '0.01',  pointValue: '1 = $1000' },
  { id: 'brent',       symbol: 'BZ=F',  rootSymbol: 'LCO',   name: 'Brent Oil',      category: 'energy',  country: 'GB', currency: 'USD', unit: 'USD/bbl', exchange: 'ICE',   contractSize: '1,000 Barrels',     monthsCode: 'FGHJKMNQUVXZ', tick: '0.01',  pointValue: '1 = $1000' },
  { id: 'natgas',      symbol: 'NG=F',  rootSymbol: 'NG',    name: 'Natural Gas',    category: 'energy',  country: 'US', currency: 'USD', unit: 'USD/MMBtu', exchange: 'NYMEX', contractSize: '10,000 MMBtu',    monthsCode: 'FGHJKMNQUVXZ', tick: '0.001', pointValue: '1 = $10000' },
  { id: 'heatingoil',  symbol: 'HO=F',  rootSymbol: 'NYF',   name: 'Heating Oil',    category: 'energy',  country: 'US', currency: 'USD', unit: 'USD/gal', exchange: 'ICE',   contractSize: '42,000 Gallons',    monthsCode: 'FGHJKMNQUVXZ', tick: '0.0001', pointValue: '1 = $42000' },
  { id: 'rbob',        symbol: 'RB=F',  rootSymbol: 'GPR',   name: 'Gasoline RBOB',  category: 'energy',  country: 'US', currency: 'USD', unit: 'USD/gal', exchange: 'ICE',   contractSize: '42,000 gallons',    monthsCode: 'FGHJKMNQUVXZ', tick: '0.0001', pointValue: '1 = $42000' },
  { id: 'dutchttf',    symbol: 'TTF=F', rootSymbol: 'TFMBMc1', name: 'Dutch TTF Gas', category: 'energy', country: 'NL', currency: 'EUR', unit: 'EUR/MWh', exchange: 'ICE' },
  { id: 'londongasoil', symbol: 'G=F',  rootSymbol: 'LGO',   name: 'London Gas Oil', category: 'energy',  country: 'GB', currency: 'USD', unit: 'USD/t',   exchange: 'ICE',   contractSize: '100 Metric Tons',   monthsCode: 'FGHJKMNQUVXZ', pointValue: '1 = $100' },

  // ============ METAIS INDUSTRIAIS (LME) ============
  { id: 'aluminium',   symbol: 'ALI=F', rootSymbol: 'MAL',   name: 'Aluminium',      category: 'industrial_metals', country: 'XX', currency: 'USD', unit: 'USD/t', exchange: 'LME', contractSize: '25 Tonnes',      monthsCode: 'FGHJKMNQUVXZ', pointValue: '1 = $25' },
  { id: 'zinc',        symbol: 'ZNC=F', rootSymbol: 'MZN',   name: 'Zinc',           category: 'industrial_metals', country: 'XX', currency: 'USD', unit: 'USD/t', exchange: 'LME', contractSize: '25 metric tons', monthsCode: 'FGHJKMNQUVXZ', pointValue: '1 = $25' },
  { id: 'copper_lme',  symbol: 'HG=F',  rootSymbol: 'MCU',   name: 'Copper (LME)',   category: 'industrial_metals', country: 'XX', currency: 'USD', unit: 'USD/t', exchange: 'LME', contractSize: '25 tonnes',                                  pointValue: '1 = $25' },
  { id: 'nickel',      symbol: 'NID=F', rootSymbol: 'NICKEL',name: 'Nickel',         category: 'industrial_metals', country: 'XX', currency: 'USD', unit: 'USD/t', exchange: 'LME', contractSize: '6 Tonnes',      monthsCode: 'FGHJKMNQUVXZ', pointValue: '1 = $6' },

  // ============ GRÃOS ============
  { id: 'us_wheat',    symbol: 'ZW=F',  rootSymbol: 'ZW',    name: 'US Wheat',       category: 'grains',  country: 'US', currency: 'USD', unit: 'USc/bu',  exchange: 'ICE',   contractSize: '5,000 Bushels',     monthsCode: 'HKNUZ',        tick: '0.25',  pointValue: '1 = $50' },
  { id: 'hrw_wheat',   symbol: 'KE=F',  rootSymbol: 'KE',    name: 'Hard Red Winter Wheat', category: 'grains', country: 'US', currency: 'USD', unit: 'USc/bu', exchange: 'KCBT', contractSize: '5,000 Bushels',   monthsCode: 'HKNUZ',        tick: '0.25',  pointValue: '1 = $50' },
  { id: 'london_wheat', symbol: 'LWB=F', rootSymbol: 'LWB',  name: 'London Wheat',   category: 'grains',  country: 'GB', currency: 'GBP', unit: 'GBP/t',   exchange: 'ICE' },
  { id: 'rough_rice',  symbol: 'ZR=F',  rootSymbol: 'RR',    name: 'Rough Rice',     category: 'grains',  country: 'US', currency: 'USD', unit: 'USD/cwt', exchange: 'ICE',   contractSize: '2,000 cwt',          monthsCode: 'FHKNUX',       tick: '0.005', pointValue: '1 = $20' },
  { id: 'us_corn',     symbol: 'ZC=F',  rootSymbol: 'ZC',    name: 'US Corn',        category: 'grains',  country: 'US', currency: 'USD', unit: 'USc/bu',  exchange: 'ICE',   contractSize: '5,000 Bushels',     monthsCode: 'HKNUZ',        tick: '0.25',  pointValue: '1 = $50' },
  { id: 'us_soybeans', symbol: 'ZS=F',  rootSymbol: 'ZS',    name: 'US Soybeans',    category: 'grains',  country: 'US', currency: 'USD', unit: 'USc/bu',  exchange: 'ICE',   contractSize: '5,000 Bushels',     monthsCode: 'FHKNQUX',      tick: '0.25',  pointValue: '1 = $50' },
  { id: 'soybean_oil', symbol: 'ZL=F',  rootSymbol: 'ZL',    name: 'US Soybean Oil', category: 'grains',  country: 'US', currency: 'USD', unit: 'USc/lb',  exchange: 'ICE',   contractSize: '60,000 Lbs.',       monthsCode: 'FHKNQUVZ',     tick: '0.01',  pointValue: '1 = $600' },
  { id: 'soybean_meal',symbol: 'ZM=F',  rootSymbol: 'ZM',    name: 'US Soybean Meal',category: 'grains',  country: 'US', currency: 'USD', unit: 'USD/ston',exchange: 'ICE',   contractSize: '100 Tonnes',        monthsCode: 'FHKNQUVZ',     tick: '0.10',  pointValue: '1 = $100' },
  { id: 'oats',        symbol: 'ZO=F',  rootSymbol: 'O',     name: 'Oats',           category: 'grains',  country: 'US', currency: 'USD', unit: 'USc/bu',  exchange: 'ICE',   contractSize: '5,000 Bushels',     monthsCode: 'HKNUZ',        tick: '0.25',  pointValue: '1 = $50' },

  // ============ SOFTS ============
  { id: 'us_cotton',   symbol: 'CT=F',  rootSymbol: 'CT',    name: 'US Cotton #2',   category: 'softs',   country: 'US', currency: 'USD', unit: 'USc/lb',  exchange: 'ICE',   contractSize: '50,000 Lbs.',       monthsCode: 'HKNVZ',        tick: '0.01',  pointValue: '1 = $500' },
  { id: 'us_cocoa',    symbol: 'CC=F',  rootSymbol: 'CC',    name: 'US Cocoa',       category: 'softs',   country: 'US', currency: 'USD', unit: 'USD/t',   exchange: 'ICE',   contractSize: '10 Metric Tons',    monthsCode: 'HKNUZ',        tick: '1',     pointValue: '1 = $10' },
  { id: 'us_coffee',   symbol: 'KC=F',  rootSymbol: 'KC',    name: 'US Coffee C',    category: 'softs',   country: 'US', currency: 'USD', unit: 'USc/lb',  exchange: 'ICE',   contractSize: '37,500 Lbs.',       monthsCode: 'HKNUZ',        tick: '0.05',  pointValue: '1 = $375' },
  { id: 'london_coffee', symbol: 'LRC=F', rootSymbol: 'RC',  name: 'London Coffee',  category: 'softs',   country: 'GB', currency: 'USD', unit: 'USD/t',   exchange: 'ICE',   contractSize: '10 Metric Tons',    monthsCode: 'FHKNUX',       pointValue: '1 = $10' },
  { id: 'us_sugar',    symbol: 'SB=F',  rootSymbol: 'SB',    name: 'US Sugar #11',   category: 'softs',   country: 'US', currency: 'USD', unit: 'USc/lb',  exchange: 'ICE',   contractSize: '112,000 Lbs.',      monthsCode: 'HKNV',         tick: '0.01',  pointValue: '1 = $1120' },
  { id: 'orange_juice',symbol: 'OJ=F',  rootSymbol: 'OJ',    name: 'Orange Juice',   category: 'softs',   country: 'US', currency: 'USD', unit: 'USc/lb',  exchange: 'ICE',   contractSize: '15,000 Lbs.',       monthsCode: 'FHKNUX',       tick: '0.05',  pointValue: '1 = $150' },
  { id: 'lumber',      symbol: 'LBR=F', rootSymbol: 'LXRc1', name: 'Lumber',         category: 'softs',   country: 'US', currency: 'USD', unit: 'USD/MBF', exchange: 'CME',   contractSize: '27.5 mbf',          monthsCode: 'FHKNUX',       tick: '0.50',  pointValue: '1 = $27.5' },

  // ============ PECUÁRIA ============
  { id: 'live_cattle', symbol: 'LE=F',  rootSymbol: 'LCc1',  name: 'Live Cattle',    category: 'livestock', country: 'US', currency: 'USD', unit: 'USc/lb', exchange: 'CME', contractSize: '40,000 Lbs.',       monthsCode: 'GJMQVZ',       tick: '0.025', pointValue: '1 = $400' },
  { id: 'feeder_cattle', symbol: 'GF=F', rootSymbol: 'FC',   name: 'Feeder Cattle',  category: 'livestock', country: 'US', currency: 'USD', unit: 'USc/lb', exchange: 'ICE', contractSize: '50,000 Lbs.',       monthsCode: 'FHJKQUVX',     tick: '0.025', pointValue: '1 = $500' },
  { id: 'lean_hogs',   symbol: 'HE=F',  rootSymbol: 'LHc1',  name: 'Lean Hogs',      category: 'livestock', country: 'US', currency: 'USD', unit: 'USc/lb', exchange: 'CME', contractSize: '40,000 Lbs.',       monthsCode: 'GJKMNQVZ',     tick: '0.025', pointValue: '1 = $400' },
]

export const COMMODITIES_BY_ID = new Map(COMMODITIES.map((c) => [c.id, c]))
export const COMMODITIES_BY_SYMBOL = new Map(COMMODITIES.map((c) => [c.symbol, c]))

/** Default subset que aparece se workspace ainda não personalizou. */
export const DEFAULT_DASHBOARD_IDS: string[] = [
  // Grãos primeiro (core do agronegócio BR)
  'us_soybeans', 'us_corn', 'us_wheat', 'soybean_meal', 'soybean_oil',
  // FX implícito via USD/BRL — vem do widget separado existente
  // Metais (hedge inflação)
  'gold', 'silver', 'copper',
  // Energia (correlação com fretes/insumos)
  'wti', 'brent',
  // Softs adjacentes
  'us_cotton', 'us_sugar',
]

export const CATEGORY_LABELS: Record<CommodityCategory, string> = {
  metals: 'Metais preciosos',
  energy: 'Energia',
  industrial_metals: 'Metais industriais',
  grains: 'Grãos',
  softs: 'Softs',
  livestock: 'Pecuária',
}
