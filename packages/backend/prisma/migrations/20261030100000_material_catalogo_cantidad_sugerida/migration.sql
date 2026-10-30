-- Cantidad de referencia del catálogo de materiales: se propone al
-- agregar el ítem a un proyecto (ej: 250 si la unidad base es "kg").
ALTER TABLE "material_catalogos" ADD COLUMN "cantidadSugerida" REAL;
