CREATE TABLE "portadas_catalogo" (
    "categoria" "SegmentoCliente" NOT NULL,
    "imagen_key" TEXT NOT NULL,
    "imagen_mime" TEXT NOT NULL,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "portadas_catalogo_pkey" PRIMARY KEY ("categoria")
);
