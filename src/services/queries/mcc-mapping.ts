/**
 * Merchant Category Code (MCC) mapping and spend-by-category queries.
 *
 * Maps ~700+ MCC codes (f9_dw007_mcc) to readable category labels, then
 * aggregates spend metrics by category. Combines with the merchant normalization
 * pipeline for a full picture of where customers shop and what they buy.
 *
 * Source table: mart_finexus.authorized_transaction
 */

import { runQuery } from "@/lib/bigquery";

export interface MccCategory {
  mcc: string;
  category: string;
}

export interface SpendByCategory {
  category: string;
  txn_count: number;
  total_spend_idr: number;
  avg_spend_idr: number;
  unique_customers: number;
  pct_of_total_spend: number;
}

export interface MerchantWithCategory {
  merchant_name: string;
  category: string;
  txn_type_label: string;
  txn_count: number;
  total_spend_idr: number;
  unique_customers: number;
}

/**
 * Inline MCC mapping CTE — a massive UNNEST of ~700+ STRUCT entries.
 * Kept as a shared constant so multiple queries can reuse it.
 */
const MCC_MAPPING_CTE = `
  mcc_map AS (
    SELECT * FROM UNNEST(ARRAY<STRUCT<mcc STRING, category STRING>>[
      STRUCT('0742','Veterinary Services'),STRUCT('0763','Agricultural Co-ops'),STRUCT('0780','Landscaping/Horticultural'),
      STRUCT('1520','General Contractors - Residential'),STRUCT('1711','Heating/Plumbing/AC Contractors'),STRUCT('1731','Electrical Contractors'),
      STRUCT('1740','Masonry/Stonework/Tile Contractors'),STRUCT('1750','Carpentry Contractors'),STRUCT('1761','Roofing/Siding/Sheet Metal'),
      STRUCT('1771','Concrete Work Contractors'),STRUCT('1799','Special Trade Contractors'),
      STRUCT('2741','Miscellaneous Publishing'),STRUCT('2791','Typesetting/Engraving'),STRUCT('2842','Specialty Cleaning/Polishing'),
      STRUCT('4011','Railroads'),STRUCT('4111','Local/Suburban Commuter Transport'),STRUCT('4112','Passenger Railways'),
      STRUCT('4119','Ambulance Services'),STRUCT('4121','Taxicabs/Rideshares'),STRUCT('4131','Bus Lines'),
      STRUCT('4214','Motor Freight/Moving/Storage'),STRUCT('4215','Courier Services'),STRUCT('4225','Public Warehousing'),
      STRUCT('4411','Steamship/Cruise Lines'),STRUCT('4457','Boat Rentals/Leases'),STRUCT('4468','Marinas'),
      STRUCT('4511','Airlines/Air Carriers'),STRUCT('4582','Airports/Airport Terminals'),STRUCT('4722','Travel Agencies/Tour Operators'),
      STRUCT('4784','Tolls/Bridge Fees'),STRUCT('4789','Transportation Services'),STRUCT('4812','Telecommunication Equipment'),
      STRUCT('4814','Telecommunication Services'),STRUCT('4815','Monthly Phone Services'),STRUCT('4816','Computer Network Services'),
      STRUCT('4821','Telegraph Services'),STRUCT('4829','Wire Transfers/Money Orders'),STRUCT('4899','Cable/Pay Television'),
      STRUCT('4900','Utilities'),
      STRUCT('5013','Motor Vehicle Supplies'),STRUCT('5021','Office/Commercial Furniture'),STRUCT('5039','Construction Materials'),
      STRUCT('5044','Photographic/Photocopy Equipment'),STRUCT('5045','Computers/Peripherals'),STRUCT('5046','Commercial Equipment'),
      STRUCT('5047','Medical/Dental/Ophthalmic Equipment'),STRUCT('5051','Metal Service Centers'),STRUCT('5065','Electronic Parts'),
      STRUCT('5072','Hardware Equipment'),STRUCT('5074','Plumbing/Heating Equipment'),STRUCT('5085','Industrial Supplies'),
      STRUCT('5094','Precious Stones/Metals/Jewelry'),STRUCT('5099','Durable Goods'),STRUCT('5111','Stationery/Office Supplies'),
      STRUCT('5122','Drugs/Drug Sundries'),STRUCT('5131','Piece Goods/Notions'),STRUCT('5137','Men/Women/Children Uniforms'),
      STRUCT('5139','Commercial Footwear'),STRUCT('5169','Chemicals/Allied Products'),STRUCT('5172','Petroleum Products'),
      STRUCT('5192','Books/Periodicals/Newspapers'),STRUCT('5193','Florists Supplies'),STRUCT('5198','Paints/Varnishes'),
      STRUCT('5199','Nondurable Goods'),
      STRUCT('5200','Home Supply Warehouse Stores'),STRUCT('5211','Lumber/Building Materials'),STRUCT('5231','Glass/Paint/Wallpaper'),
      STRUCT('5251','Hardware Stores'),STRUCT('5261','Nurseries/Lawn & Garden Supply'),STRUCT('5271','Mobile Home Dealers'),
      STRUCT('5300','Wholesale Clubs'),STRUCT('5309','Duty Free Stores'),STRUCT('5310','Discount Stores'),
      STRUCT('5311','Department Stores'),STRUCT('5331','Variety Stores'),STRUCT('5399','General Merchandise'),
      STRUCT('5411','Grocery Stores/Supermarkets'),STRUCT('5422','Freezer/Locker Meat Provisioners'),STRUCT('5441','Candy/Nut/Confectionery'),
      STRUCT('5451','Dairy Products'),STRUCT('5462','Bakeries'),STRUCT('5499','Miscellaneous Food Stores'),
      STRUCT('5511','Car/Truck Dealers (New & Used)'),STRUCT('5521','Car/Truck Dealers (Used Only)'),STRUCT('5531','Auto/Home Supply Stores'),
      STRUCT('5532','Automotive Tire Stores'),STRUCT('5533','Automotive Parts/Accessories'),STRUCT('5541','Service Stations'),
      STRUCT('5542','Automated Fuel Dispensers'),STRUCT('5551','Boat Dealers'),STRUCT('5561','Camper/RV/Utility Trailer Dealers'),
      STRUCT('5571','Motorcycle Shops/Dealers'),STRUCT('5592','Motor Homes Dealers'),STRUCT('5598','Snowmobile Dealers'),
      STRUCT('5599','Miscellaneous Auto/Vehicle Dealers'),
      STRUCT('5611','Men/Boys Clothing Stores'),STRUCT('5621','Women/Misses Clothing Stores'),STRUCT('5631','Women Accessories'),
      STRUCT('5641','Children/Infants Wear'),STRUCT('5651','Family Clothing Stores'),STRUCT('5655','Sports/Riding Apparel'),
      STRUCT('5661','Shoe Stores'),STRUCT('5681','Furriers/Fur Shops'),STRUCT('5691','Men/Women Clothing Stores'),
      STRUCT('5697','Tailors/Seamstresses/Alterations'),STRUCT('5698','Wig/Toupee Stores'),STRUCT('5699','Miscellaneous Apparel/Accessories'),
      STRUCT('5712','Furniture/Home Furnishings'),STRUCT('5713','Floor Covering Stores'),STRUCT('5714','Drapery/Window Covering/Upholstery'),
      STRUCT('5718','Fireplace/Fireplace Screens'),STRUCT('5719','Miscellaneous Home Furnishing'),STRUCT('5722','Household Appliance Stores'),
      STRUCT('5732','Electronics Stores'),STRUCT('5733','Music Stores/Musical Instruments'),STRUCT('5734','Computer Software Stores'),
      STRUCT('5735','Record Stores'),
      STRUCT('5811','Caterers'),STRUCT('5812','Eating Places/Restaurants'),STRUCT('5813','Bars/Cocktail Lounges/Nightclubs'),
      STRUCT('5814','Fast Food Restaurants'),STRUCT('5815','Digital Goods: Media'),STRUCT('5816','Digital Goods: Games'),
      STRUCT('5817','Digital Goods: Applications'),STRUCT('5818','Large Digital Goods Merchant'),
      STRUCT('5912','Drug Stores/Pharmacies'),STRUCT('5921','Package Stores - Beer/Wine/Liquor'),STRUCT('5931','Used Merchandise/Secondhand Stores'),
      STRUCT('5932','Antique Shops'),STRUCT('5933','Pawn Shops'),STRUCT('5935','Wrecking/Salvage Yards'),
      STRUCT('5937','Antique Reproductions'),STRUCT('5940','Bicycle Shops'),STRUCT('5941','Sporting Goods Stores'),
      STRUCT('5942','Book Stores'),STRUCT('5943','Stationery Stores'),STRUCT('5944','Jewelry Stores/Watches/Clocks'),
      STRUCT('5945','Hobby/Toy/Game Shops'),STRUCT('5946','Camera/Photographic Supply'),STRUCT('5947','Gift/Card/Novelty/Souvenir'),
      STRUCT('5948','Luggage/Leather Goods'),STRUCT('5949','Sewing/Needlework/Fabric'),STRUCT('5950','Glassware/Crystal Stores'),
      STRUCT('5960','Direct Marketing - Insurance'),STRUCT('5962','Direct Marketing - Travel'),STRUCT('5963','Door-to-Door Sales'),
      STRUCT('5964','Direct Marketing - Catalog'),STRUCT('5965','Direct Marketing - Catalog/Retail'),STRUCT('5966','Direct Marketing - Outbound Telemarketing'),
      STRUCT('5967','Direct Marketing - Inbound Teleservices'),STRUCT('5968','Direct Marketing - Subscriptions'),STRUCT('5969','Direct Marketing - Other'),
      STRUCT('5970','Artist Supply/Craft Stores'),STRUCT('5971','Art Dealers/Galleries'),STRUCT('5972','Stamp/Coin Stores'),
      STRUCT('5973','Religious Goods Stores'),STRUCT('5975','Hearing Aids'),STRUCT('5976','Orthopedic Goods/Prosthetic Devices'),
      STRUCT('5977','Cosmetic Stores'),STRUCT('5978','Typewriter Stores'),STRUCT('5983','Fuel Dealers'),
      STRUCT('5992','Florists'),STRUCT('5993','Cigar Stores/Stands'),STRUCT('5994','News Dealers/Newsstands'),
      STRUCT('5995','Pet Shops/Pet Food'),STRUCT('5996','Swimming Pools'),STRUCT('5997','Electric Razor Stores'),
      STRUCT('5998','Tent/Awning Shops'),STRUCT('5999','Miscellaneous Retail Stores'),
      STRUCT('6010','Financial Institutions - Manual Cash'),STRUCT('6011','Financial Institutions - ATM'),STRUCT('6012','Financial Institutions - Merchandise'),
      STRUCT('6050','Quasi Cash - Financial Institutions'),STRUCT('6051','Non-Financial Institutions - Foreign Currency/Money Orders'),
      STRUCT('6211','Security Brokers/Dealers'),STRUCT('6300','Insurance Underwriting/Premiums'),STRUCT('6381','Insurance Premiums'),
      STRUCT('6399','Insurance - Default'),STRUCT('6513','Real Estate Agents/Managers'),
      STRUCT('7011','Hotels/Motels/Resorts'),STRUCT('7012','Timeshares'),STRUCT('7032','Sporting/Recreation Camps'),
      STRUCT('7033','Trailer Parks/Campgrounds'),STRUCT('7210','Laundry/Cleaning Services'),STRUCT('7211','Laundry Services - Family/Commercial'),
      STRUCT('7216','Dry Cleaners'),STRUCT('7217','Carpet/Upholstery Cleaning'),STRUCT('7221','Photographic Studios'),
      STRUCT('7230','Beauty/Barber Shops'),STRUCT('7251','Shoe Repair/Hat Cleaning/Shine'),STRUCT('7261','Funeral Services/Crematories'),
      STRUCT('7273','Dating/Escort Services'),STRUCT('7276','Tax Preparation Services'),STRUCT('7277','Counseling Services'),
      STRUCT('7278','Buying/Shopping Services'),STRUCT('7296','Clothing Rental'),STRUCT('7297','Massage Parlors'),
      STRUCT('7298','Health/Beauty Spas'),STRUCT('7299','Miscellaneous Personal Services'),
      STRUCT('7311','Advertising Services'),STRUCT('7321','Consumer Credit Reporting'),STRUCT('7332','Blueprinting/Photocopying'),
      STRUCT('7333','Commercial Photography/Art/Graphics'),STRUCT('7338','Quick Copy/Reproduction'),STRUCT('7339','Stenographic/Secretarial Services'),
      STRUCT('7342','Exterminating/Disinfecting'),STRUCT('7349','Cleaning/Maintenance/Janitorial'),STRUCT('7361','Employment Agencies/Temp Staffing'),
      STRUCT('7372','Computer Programming/Data Processing'),STRUCT('7375','Information Retrieval Services'),STRUCT('7379','Computer Maintenance/Repair'),
      STRUCT('7392','Management/Consulting/PR'),STRUCT('7393','Detective/Protective Agencies'),STRUCT('7394','Equipment Rental/Leasing'),
      STRUCT('7395','Photofinishing Laboratories'),STRUCT('7399','Miscellaneous Business Services'),
      STRUCT('7511','Truck Stop'),STRUCT('7512','Car Rental Agencies'),STRUCT('7513','Truck/Utility Trailer Rentals'),
      STRUCT('7519','Motor Home/RV Rentals'),STRUCT('7523','Parking Lots/Garages'),STRUCT('7531','Auto Body Repair Shops'),
      STRUCT('7534','Tire Retreading/Repair'),STRUCT('7535','Auto Paint Shops'),STRUCT('7538','Auto Service Shops'),
      STRUCT('7542','Car Washes'),STRUCT('7549','Towing Services'),
      STRUCT('7622','Electronics Repair Shops'),STRUCT('7623','AC/Refrigeration Repair'),STRUCT('7629','Electrical/Small Appliance Repair'),
      STRUCT('7631','Watch/Clock/Jewelry Repair'),STRUCT('7641','Furniture Repair/Refinishing'),STRUCT('7692','Welding Repair'),
      STRUCT('7699','Miscellaneous Repair Shops'),
      STRUCT('7800','Government-Owned Lotteries'),STRUCT('7801','Government-Licensed Online Casinos'),STRUCT('7802','Government-Licensed Horse/Dog Racing'),
      STRUCT('7829','Motion Picture/Video Production'),STRUCT('7832','Motion Picture Theaters'),STRUCT('7841','Video Tape Rental'),
      STRUCT('7911','Dance Halls/Studios/Schools'),STRUCT('7922','Theatrical Producers'),STRUCT('7929','Bands/Orchestras'),
      STRUCT('7932','Billiard/Pool Establishments'),STRUCT('7933','Bowling Alleys'),STRUCT('7941','Athletic Fields/Sports Clubs'),
      STRUCT('7991','Tourist Attractions/Exhibits'),STRUCT('7992','Golf Courses - Public'),STRUCT('7993','Video Amusement Game Supplies'),
      STRUCT('7994','Video Game Arcades'),STRUCT('7995','Betting (Casinos/Lottery/Chips)'),STRUCT('7996','Amusement Parks/Carnivals'),
      STRUCT('7997','Membership Clubs (Sports/Recreation/Athletic)'),STRUCT('7998','Aquariums/Seaquariums/Dolphinariums'),STRUCT('7999','Recreation Services'),
      STRUCT('8011','Doctors'),STRUCT('8021','Dentists/Orthodontists'),STRUCT('8031','Osteopathic Physicians'),
      STRUCT('8041','Chiropractors'),STRUCT('8042','Optometrists/Ophthalmologists'),STRUCT('8043','Opticians/Optical Goods'),
      STRUCT('8049','Podiatrists/Chiropodists'),STRUCT('8050','Nursing/Personal Care Facilities'),STRUCT('8062','Hospitals'),
      STRUCT('8071','Medical/Dental Labs'),STRUCT('8099','Medical Services/Health Practitioners'),
      STRUCT('8111','Legal Services/Attorneys'),STRUCT('8211','Elementary/Secondary Schools'),STRUCT('8220','Colleges/Universities'),
      STRUCT('8241','Correspondence Schools'),STRUCT('8244','Business/Secretarial Schools'),STRUCT('8249','Vocational/Trade Schools'),
      STRUCT('8299','Schools/Educational Services'),STRUCT('8351','Child Care Services'),STRUCT('8398','Charitable/Social Service Organizations'),
      STRUCT('8641','Civic/Social/Fraternal Associations'),STRUCT('8651','Political Organizations'),STRUCT('8661','Religious Organizations'),
      STRUCT('8675','Automobile Associations'),STRUCT('8699','Membership Organizations'),
      STRUCT('8734','Testing Laboratories'),STRUCT('8911','Architectural/Engineering/Surveying'),STRUCT('8931','Accounting/Auditing/Bookkeeping'),
      STRUCT('8999','Professional Services'),
      STRUCT('9211','Court Costs/Fines'),STRUCT('9222','Fines'),STRUCT('9223','Bail/Bond Payments'),
      STRUCT('9311','Tax Payments'),STRUCT('9399','Government Services'),STRUCT('9402','Postal Services - Government Only'),
      STRUCT('9405','US Federal Government Agencies'),STRUCT('9700','Automated Referral Service'),STRUCT('9702','Emergency Services (GCAS)'),
      STRUCT('9950','Intra-Company Purchases')
    ])
  )
`;

/**
 * Get spend distribution by MCC category.
 * Returns categories ranked by total spend or transaction count.
 */
export async function getSpendByCategory(
  startDate: string,
  endDate: string,
  limit: number = 30,
  orderBy: "txn_count" | "total_spend" = "total_spend"
): Promise<SpendByCategory[]> {
  const orderCol = orderBy === "txn_count" ? "txn_count" : "total_spend_idr";

  const sql = `
    WITH ${MCC_MAPPING_CTE},
    txns AS (
      SELECT
        t.f9_dw007_mcc AS mcc,
        t.F9_DW007_AMT_REQ,
        t.px_dw007_urn
      FROM \`storage-58f5a02c.mart_finexus.authorized_transaction\` t
      WHERE t.f9_dw007_dt BETWEEN @startDate AND @endDate
        AND (t.fx_dw007_stat IS NULL OR TRIM(t.fx_dw007_stat) = '' OR t.fx_dw007_stat = ' ')
        AND t.fx_dw007_txn_typ NOT IN ('PM', 'BE', 'RF')
        AND t.f9_dw007_ori_amt > 0
    ),
    categorized AS (
      SELECT
        COALESCE(m.category, CONCAT('Unknown MCC (', t.mcc, ')')) AS category,
        t.F9_DW007_AMT_REQ,
        t.px_dw007_urn
      FROM txns t
      LEFT JOIN mcc_map m ON t.mcc = m.mcc
    ),
    totals AS (
      SELECT SUM(F9_DW007_AMT_REQ / 100) AS grand_total FROM categorized
    )
    SELECT
      c.category,
      COUNT(*) AS txn_count,
      ROUND(SUM(c.F9_DW007_AMT_REQ / 100)) AS total_spend_idr,
      ROUND(AVG(c.F9_DW007_AMT_REQ / 100)) AS avg_spend_idr,
      COUNT(DISTINCT c.px_dw007_urn) AS unique_customers,
      ROUND(SAFE_DIVIDE(SUM(c.F9_DW007_AMT_REQ / 100), t.grand_total) * 100, 2) AS pct_of_total_spend
    FROM categorized c
    CROSS JOIN totals t
    GROUP BY c.category, t.grand_total
    ORDER BY ${orderCol} DESC
    LIMIT @limit
  `;

  return runQuery<SpendByCategory>(sql, { startDate, endDate, limit });
}

/**
 * Get top merchants with their MCC category, broken down by transaction type
 * (Online / QRIS / Offline).
 */
export async function getMerchantsByCategory(
  startDate: string,
  endDate: string,
  limit: number = 50
): Promise<MerchantWithCategory[]> {
  const sql = `
    WITH ${MCC_MAPPING_CTE},
    raw_txns AS (
      SELECT
        fx_dw007_merc_name,
        f9_dw007_mcc AS mcc,
        fx_dw007_txn_typ,
        fx_dw007_rte_dest,
        F9_DW007_AMT_REQ,
        px_dw007_urn
      FROM \`storage-58f5a02c.mart_finexus.authorized_transaction\`
      WHERE f9_dw007_dt BETWEEN @startDate AND @endDate
        AND (fx_dw007_stat IS NULL OR TRIM(fx_dw007_stat) = '' OR fx_dw007_stat = ' ')
        AND fx_dw007_txn_typ NOT IN ('PM', 'BE', 'RF')
        AND f9_dw007_ori_amt > 0
    ),
    -- Simplified merchant normalization (step 1 + step 4 gateway extraction)
    normalized AS (
      SELECT
        CASE
          WHEN REGEXP_CONTAINS(fx_dw007_merc_name, r'^[\\d\\s\\-_/]+$') THEN 'Unknown Merchant'
          WHEN REGEXP_CONTAINS(fx_dw007_merc_name, r'\\*')
            THEN TRIM(REGEXP_EXTRACT(fx_dw007_merc_name, r'^.+\\s*\\*\\s*(.+)'))
          ELSE TRIM(fx_dw007_merc_name)
        END AS merchant_name,
        COALESCE(m.category, CONCAT('Unknown MCC (', r.mcc, ')')) AS category,
        CASE
          WHEN r.fx_dw007_txn_typ = 'TM' THEN 'Online'
          WHEN r.fx_dw007_txn_typ = 'RA' AND r.fx_dw007_rte_dest = 'L' THEN 'QRIS'
          ELSE 'Offline'
        END AS txn_type_label,
        r.F9_DW007_AMT_REQ,
        r.px_dw007_urn
      FROM raw_txns r
      LEFT JOIN mcc_map m ON r.mcc = m.mcc
    )
    SELECT
      merchant_name,
      category,
      txn_type_label,
      COUNT(*) AS txn_count,
      ROUND(SUM(F9_DW007_AMT_REQ / 100)) AS total_spend_idr,
      COUNT(DISTINCT px_dw007_urn) AS unique_customers
    FROM normalized
    WHERE merchant_name != 'Unknown Merchant'
    GROUP BY merchant_name, category, txn_type_label
    ORDER BY txn_count DESC
    LIMIT @limit
  `;

  return runQuery<MerchantWithCategory>(sql, { startDate, endDate, limit });
}

/**
 * Get spend split by transaction channel: Online vs QRIS vs Offline.
 */
export async function getSpendByChannel(
  startDate: string,
  endDate: string
): Promise<{ channel: string; txn_count: number; total_spend_idr: number; unique_customers: number; pct_of_total_spend: number }[]> {
  const sql = `
    WITH txns AS (
      SELECT
        CASE
          WHEN fx_dw007_txn_typ = 'TM' THEN 'Online'
          WHEN fx_dw007_txn_typ = 'RA' AND fx_dw007_rte_dest = 'L' THEN 'QRIS'
          ELSE 'Offline'
        END AS channel,
        F9_DW007_AMT_REQ,
        px_dw007_urn
      FROM \`storage-58f5a02c.mart_finexus.authorized_transaction\`
      WHERE f9_dw007_dt BETWEEN @startDate AND @endDate
        AND (fx_dw007_stat IS NULL OR TRIM(fx_dw007_stat) = '' OR fx_dw007_stat = ' ')
        AND fx_dw007_txn_typ NOT IN ('PM', 'BE', 'RF')
        AND f9_dw007_ori_amt > 0
    ),
    totals AS (
      SELECT SUM(F9_DW007_AMT_REQ / 100) AS grand_total FROM txns
    )
    SELECT
      t.channel,
      COUNT(*) AS txn_count,
      ROUND(SUM(t.F9_DW007_AMT_REQ / 100)) AS total_spend_idr,
      COUNT(DISTINCT t.px_dw007_urn) AS unique_customers,
      ROUND(SAFE_DIVIDE(SUM(t.F9_DW007_AMT_REQ / 100), tot.grand_total) * 100, 2) AS pct_of_total_spend
    FROM txns t
    CROSS JOIN totals tot
    GROUP BY t.channel, tot.grand_total
    ORDER BY total_spend_idr DESC
  `;

  return runQuery(sql, { startDate, endDate });
}

/**
 * Get MCC distribution for a specific merchant (normalized name).
 * Useful for drilling into what categories a merchant like "Grab" or "Tokopedia" spans.
 */
export async function getMccForMerchant(
  startDate: string,
  endDate: string,
  merchantPattern: string,
  limit: number = 20
): Promise<{ category: string; mcc: string; txn_count: number; total_spend_idr: number }[]> {
  const sql = `
    WITH ${MCC_MAPPING_CTE}
    SELECT
      COALESCE(m.category, CONCAT('Unknown MCC (', t.f9_dw007_mcc, ')')) AS category,
      t.f9_dw007_mcc AS mcc,
      COUNT(*) AS txn_count,
      ROUND(SUM(t.F9_DW007_AMT_REQ / 100)) AS total_spend_idr
    FROM \`storage-58f5a02c.mart_finexus.authorized_transaction\` t
    LEFT JOIN mcc_map m ON t.f9_dw007_mcc = m.mcc
    WHERE t.f9_dw007_dt BETWEEN @startDate AND @endDate
      AND (t.fx_dw007_stat IS NULL OR TRIM(t.fx_dw007_stat) = '' OR t.fx_dw007_stat = ' ')
      AND t.fx_dw007_txn_typ NOT IN ('PM', 'BE', 'RF')
      AND t.f9_dw007_ori_amt > 0
      AND UPPER(t.fx_dw007_merc_name) LIKE CONCAT('%', UPPER(@merchantPattern), '%')
    GROUP BY category, mcc
    ORDER BY txn_count DESC
    LIMIT @limit
  `;

  return runQuery(sql, { startDate, endDate, merchantPattern, limit });
}
