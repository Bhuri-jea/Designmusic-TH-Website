type OptionGroup={code:string;label:string;values:{code:string;label:string;description?:string}[]};
export function shakuhachiPurchaseOptions(product:{slug:string;optionGroups:OptionGroup[];skus:{optionCodes:string[]}[]}) {
 const mouthpiece=product.optionGroups.find(group=>group.code==='mouthpiece');
 const includesBalance=product.slug==='shakuhachi'&&Boolean(mouthpiece?.values.some(value=>value.code==='balance'))&&product.skus.length>0&&product.skus.every(sku=>sku.optionCodes.includes('balance'));
 return {
  optionGroups:includesBalance?product.optionGroups.filter(group=>group.code!=='mouthpiece').map(group=>({...group,values:group.values.filter(value=>product.skus.some(sku=>sku.optionCodes.includes(value.code)))})):product.optionGroups,
  fixedOptions:(includesBalance?{mouthpiece:'balance'}:{}) as Record<string,string>,
  includesBalance
 };
}
