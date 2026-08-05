export type WholesaleTerm = {
  term: string;
  definition: string;
};

export const WHOLESALE_TERMS: Record<string, WholesaleTerm> = {
  proformaInvoice: {
    term: "Proforma Invoice",
    definition:
      "A preliminary document from the supplier listing the goods they intend to ship and the expected price. It is a quotation, not the final invoice.",
  },
  commercialInvoice: {
    term: "Commercial Invoice",
    definition:
      "The supplier's final invoice showing the goods shipped and the amount due. It is the document used for customs clearance and final payment.",
  },
  billOfLading: {
    term: "Bill of Lading",
    definition:
      "The shipping document issued by the carrier that acts as the receipt for the goods loaded on the vessel and as evidence of the shipping contract.",
  },
  packingList: {
    term: "Packing List",
    definition:
      "A document from the supplier detailing exactly what is in each package or carton in the shipment. It is used to check goods against what was ordered when the container arrives.",
  },
  landedCost: {
    term: "Landed Cost",
    definition:
      "The total cost of a product by the time it reaches your warehouse. It includes the supplier price plus freight, customs, and other shipping charges.",
  },
  grossProfit: {
    term: "Gross Profit",
    definition:
      "The money made from sales before other expenses are deducted. It is calculated as sales revenue minus the cost of the goods that were sold.",
  },
  grossMargin: {
    term: "Gross Margin",
    definition:
      "Gross profit shown as a percentage of sales revenue. It tells you how much of every 1.000 in sales is left after paying for the goods themselves.",
  },
  goodsReceipt: {
    term: "Goods Receipt",
    definition:
      "The step where goods that arrive against a purchase order are checked in and added to warehouse stock. This is when inventory quantities and value increase.",
  },
  picking: {
    term: "Picking",
    definition:
      "Collecting the ordered items from their storage locations in the warehouse to prepare them for delivery to the customer.",
  },
  creditNote: {
    term: "Credit Note",
    definition:
      "A document that reduces the amount a customer owes you, usually because goods were returned or the price was adjusted. It reduces the value of the original invoice.",
  },
  weightedAverageCost: {
    term: "Weighted Average Cost",
    definition:
      "The average cost of one unit of a product in your warehouse, recalculated after each purchase based on how many units you have and what they cost. It is used to value your inventory.",
  },
};

export type WholesaleTermKey = keyof typeof WHOLESALE_TERMS;

export function getWholesaleTerm(key: WholesaleTermKey): WholesaleTerm | null {
  return WHOLESALE_TERMS[key] ?? null;
}
