-- AddColumn: comissao padrao da corretora (% sobre bruto)
ALTER TABLE "DadosEmpresa" ADD COLUMN "comissaoPadrao" DOUBLE PRECISION DEFAULT 1.5;
