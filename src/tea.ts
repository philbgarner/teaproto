export interface Tea {
  id: string;
  name: string;
  recipe: Recipe;
  temperature: number;
  ruined: boolean;
}

export interface Recipe {
  id: string;
  name: string;
  timeToBrew: number;
  idealTemperatureRange: [number, number];
  ingredientId: string | null;
  ingredientName: string | null;
  countersEffect: "bleeding" | "freezing" | "poisoned" | null;
}

export const RECIPES: Recipe[] = [
  {
    id: "iced-tea",
    name: "Iced Tea",
    timeToBrew: 10,
    idealTemperatureRange: [85, 100],
    ingredientId: "frost-leaf",
    ingredientName: "Frost Leaf",
    countersEffect: "bleeding",
  },
  {
    id: "spicy-tea",
    name: "Spicy Tea",
    timeToBrew: 10,
    idealTemperatureRange: [70, 85],
    ingredientId: "hot-pepper",
    ingredientName: "Hot Pepper",
    countersEffect: "poisoned",
  },
  {
    id: "green-tea",
    name: "Green Tea",
    timeToBrew: 10,
    idealTemperatureRange: [65, 80],
    ingredientId: "wild-herb",
    ingredientName: "Wild Herbs",
    countersEffect: "freezing",
  },
];
