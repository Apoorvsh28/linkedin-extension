-- CreateTable
CREATE TABLE "search_keywords" (
    "id" TEXT NOT NULL,
    "keyword" TEXT NOT NULL,
    "persona" "Persona",
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "search_keywords_pkey" PRIMARY KEY ("id")
);
