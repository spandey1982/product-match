-- The raw source PDF is not persisted after all — Cloudinary's account
-- plan caps raw uploads at 10MB and real supplier catalogue PDFs
-- routinely exceed that. See HmCatalogueImport's updated doc comment.
ALTER TABLE "hm_catalogue_imports" DROP COLUMN "sourceFileUrl";
