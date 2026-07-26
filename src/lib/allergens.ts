// The 14 UK-regulated food allergens (Food Information Regulations 2014).
// `key` is the canonical lowercase value stored in menu_items.allergens[];
// `label` is shown to shop owners. Customer badges capitalise the key (Slice 1).
export const UK_ALLERGENS: { key: string; label: string }[] = [
  { key: "celery", label: "Celery" },
  { key: "gluten", label: "Cereals containing gluten" },
  { key: "crustaceans", label: "Crustaceans" },
  { key: "eggs", label: "Eggs" },
  { key: "fish", label: "Fish" },
  { key: "lupin", label: "Lupin" },
  { key: "milk", label: "Milk" },
  { key: "molluscs", label: "Molluscs" },
  { key: "mustard", label: "Mustard" },
  { key: "nuts", label: "Tree nuts" },
  { key: "peanuts", label: "Peanuts" },
  { key: "sesame", label: "Sesame" },
  { key: "soya", label: "Soya" },
  { key: "sulphites", label: "Sulphur dioxide / sulphites" },
]
