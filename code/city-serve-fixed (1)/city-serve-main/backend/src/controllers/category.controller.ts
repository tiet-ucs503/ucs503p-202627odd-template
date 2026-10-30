import { Category } from "../models";
import { Request, Response } from "express";
import { getDatasetCategories } from "../services/dataset.service";

export const listCategories = async (req: Request, res: Response) => {
  try {
    let dbCategories: any[] = [];
    try {
      dbCategories = await Category.findAll({ order: [["name", "ASC"]] });
    } catch {
      // DB schema column difference fallback
    }

    const datasetCats = getDatasetCategories();
    // Combine or fallback to dataset
    if (dbCategories.length > 0) {
      res.json(dbCategories);
    } else {
      res.json(datasetCats);
    }
  } catch (error) {
    res.status(500).json({ error: "Failed to get categories" });
  }
};

export const getCategory = async (req: Request, res: Response) => {
  try {
    const slug = req.params.slug;
    let category: any = null;
    try {
      category = await Category.findOne({ where: { slug } });
    } catch {
      // fallback
    }

    if (category) return res.json(category);

    const datasetCats = getDatasetCategories();
    const found = datasetCats.find((c) => c.slug === slug || c.name.toLowerCase() === slug.toLowerCase());
    if (found) return res.json(found);

    return res.status(404).json({ error: "Category not found." });
  } catch (error) {
    res.status(500).json({ error: "Failed to get category" });
  }
};
