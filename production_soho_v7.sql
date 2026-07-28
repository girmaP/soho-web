-- Carta real de SOHO Cambados. Fuente: https://menuyvinos.com/soho/
-- Revisada el 20/07/2026. Precios finales con IVA incluido (10%).
begin;
delete from public.products;
delete from public.categories;
insert into public.categories(name,sort_order) values ('BOCADILLOS',1);
insert into public.categories(name,sort_order) values ('BOCADILLOS ESPECIALES EN PAN BLANDO',2);
insert into public.categories(name,sort_order) values ('SANDWICHES',3);
insert into public.categories(name,sort_order) values ('HAMBURGUESAS',4);
insert into public.categories(name,sort_order) values ('HAMBURGUESAS PREMIUM',5);
insert into public.categories(name,sort_order) values ('TOSTAS',6);
insert into public.categories(name,sort_order) values ('PASTAS',7);
insert into public.categories(name,sort_order) values ('NUGGETS Y FINGERS',8);
insert into public.categories(name,sort_order) values ('PLATOS COMBINADOS ESTILO MIRO PEREIRA',9);
insert into public.categories(name,sort_order) values ('RACIONES DE PATATAS FRITAS',10);
insert into public.categories(name,sort_order) values ('ENSALADAS',11);
insert into public.categories(name,sort_order) values ('PARA DESAYUNAR',12);
insert into public.categories(name,sort_order) values ('PREPARA TU COMBI DESAYUNO',13);
insert into public.categories(name,sort_order) values ('BEBIDAS',14);
insert into public.products(category_id,name,description,price,available,recommended,vat_rate) select id,'PECHUGA','',5.50,true,false,10 from public.categories where name='BOCADILLOS';
insert into public.products(category_id,name,description,price,available,recommended,vat_rate) select id,'PECHUGA CON QUESO','',5.90,true,false,10 from public.categories where name='BOCADILLOS';
insert into public.products(category_id,name,description,price,available,recommended,vat_rate) select id,'PECHUGA CON QUESO Y BACON','',6.30,true,false,10 from public.categories where name='BOCADILLOS';
insert into public.products(category_id,name,description,price,available,recommended,vat_rate) select id,'PECHUGA COMPLETO','',6.50,true,false,10 from public.categories where name='BOCADILLOS';
insert into public.products(category_id,name,description,price,available,recommended,vat_rate) select id,'PECHUGA ESPECIAL','',6.90,true,false,10 from public.categories where name='BOCADILLOS';
insert into public.products(category_id,name,description,price,available,recommended,vat_rate) select id,'PECHUGA CON PIMIENTOS Y QUESO','',6.20,true,false,10 from public.categories where name='BOCADILLOS';
insert into public.products(category_id,name,description,price,available,recommended,vat_rate) select id,'PECHUGA SOHO','',7.50,true,false,10 from public.categories where name='BOCADILLOS';
insert into public.products(category_id,name,description,price,available,recommended,vat_rate) select id,'LOMO','',4.90,true,false,10 from public.categories where name='BOCADILLOS';
insert into public.products(category_id,name,description,price,available,recommended,vat_rate) select id,'LOMO CON QUESO','',5.30,true,false,10 from public.categories where name='BOCADILLOS';
insert into public.products(category_id,name,description,price,available,recommended,vat_rate) select id,'LOMO CON QUESO Y BACON','',5.70,true,false,10 from public.categories where name='BOCADILLOS';
insert into public.products(category_id,name,description,price,available,recommended,vat_rate) select id,'LOMO COMPLETO','',5.90,true,false,10 from public.categories where name='BOCADILLOS';
insert into public.products(category_id,name,description,price,available,recommended,vat_rate) select id,'LOMO ESPECIAL','',6.30,true,false,10 from public.categories where name='BOCADILLOS';
insert into public.products(category_id,name,description,price,available,recommended,vat_rate) select id,'LOMO FRESCO','',5.50,true,false,10 from public.categories where name='BOCADILLOS';
insert into public.products(category_id,name,description,price,available,recommended,vat_rate) select id,'LOMO FRESCO CON QUESO','',5.90,true,false,10 from public.categories where name='BOCADILLOS';
insert into public.products(category_id,name,description,price,available,recommended,vat_rate) select id,'LOMO FRESCO CON QUESO Y PIMIENTOS','',6.30,true,false,10 from public.categories where name='BOCADILLOS';
insert into public.products(category_id,name,description,price,available,recommended,vat_rate) select id,'LOMO FRESCO COMPLETO','',6.50,true,false,10 from public.categories where name='BOCADILLOS';
insert into public.products(category_id,name,description,price,available,recommended,vat_rate) select id,'LOMO FRESCO ESPECIAL','',6.90,true,false,10 from public.categories where name='BOCADILLOS';
insert into public.products(category_id,name,description,price,available,recommended,vat_rate) select id,'JAMÓN ASADO','',5.50,true,false,10 from public.categories where name='BOCADILLOS';
insert into public.products(category_id,name,description,price,available,recommended,vat_rate) select id,'JAMÓN ASADO CON QUESO','',5.90,true,false,10 from public.categories where name='BOCADILLOS';
insert into public.products(category_id,name,description,price,available,recommended,vat_rate) select id,'JAMÓN ASADO EN PAN BLANDO AL ESTILO DON INFANTE','',5.50,true,false,10 from public.categories where name='BOCADILLOS';
insert into public.products(category_id,name,description,price,available,recommended,vat_rate) select id,'JAMÓN ASADO EN PAN BLANDO AL ESTILO DON INFANTE CON QUESO','',5.90,true,false,10 from public.categories where name='BOCADILLOS';
insert into public.products(category_id,name,description,price,available,recommended,vat_rate) select id,'BACON','',4.90,true,false,10 from public.categories where name='BOCADILLOS';
insert into public.products(category_id,name,description,price,available,recommended,vat_rate) select id,'BACON CON QUESO','',5.40,true,false,10 from public.categories where name='BOCADILLOS';
insert into public.products(category_id,name,description,price,available,recommended,vat_rate) select id,'BACON COMPLETO','',5.90,true,false,10 from public.categories where name='BOCADILLOS';
insert into public.products(category_id,name,description,price,available,recommended,vat_rate) select id,'BACON ESPECIAL','',6.30,true,false,10 from public.categories where name='BOCADILLOS';
insert into public.products(category_id,name,description,price,available,recommended,vat_rate) select id,'PINCHOS','',5.90,true,false,10 from public.categories where name='BOCADILLOS';
insert into public.products(category_id,name,description,price,available,recommended,vat_rate) select id,'PINCHOS CON QUESO','',6.30,true,false,10 from public.categories where name='BOCADILLOS';
insert into public.products(category_id,name,description,price,available,recommended,vat_rate) select id,'PEPITO','',6.00,true,false,10 from public.categories where name='BOCADILLOS';
insert into public.products(category_id,name,description,price,available,recommended,vat_rate) select id,'PEPITO CON QUESO','',6.40,true,false,10 from public.categories where name='BOCADILLOS';
insert into public.products(category_id,name,description,price,available,recommended,vat_rate) select id,'PEPITO CON QUESO Y PIMIENTOS','',6.70,true,false,10 from public.categories where name='BOCADILLOS';
insert into public.products(category_id,name,description,price,available,recommended,vat_rate) select id,'PEPITO COMPLETO','',7.00,true,false,10 from public.categories where name='BOCADILLOS';
insert into public.products(category_id,name,description,price,available,recommended,vat_rate) select id,'ZORZA','',5.50,true,false,10 from public.categories where name='BOCADILLOS';
insert into public.products(category_id,name,description,price,available,recommended,vat_rate) select id,'ZORZA CON QUESO','',5.90,true,false,10 from public.categories where name='BOCADILLOS';
insert into public.products(category_id,name,description,price,available,recommended,vat_rate) select id,'CALAMARES','',9.90,true,false,10 from public.categories where name='BOCADILLOS';
insert into public.products(category_id,name,description,price,available,recommended,vat_rate) select id,'PULPO','',12.90,true,false,10 from public.categories where name='BOCADILLOS';
insert into public.products(category_id,name,description,price,available,recommended,vat_rate) select id,'PULPO CON QUESO TETILLA','',13.90,true,false,10 from public.categories where name='BOCADILLOS';
insert into public.products(category_id,name,description,price,available,recommended,vat_rate) select id,'JAMÓN SERRANO CON TOMATE','',5.90,true,false,10 from public.categories where name='BOCADILLOS';
insert into public.products(category_id,name,description,price,available,recommended,vat_rate) select id,'TORTILLA FRANCESA','',5.10,true,false,10 from public.categories where name='BOCADILLOS';
insert into public.products(category_id,name,description,price,available,recommended,vat_rate) select id,'TORTILLA FRANCESA CON QUESO','',5.50,true,false,10 from public.categories where name='BOCADILLOS';
insert into public.products(category_id,name,description,price,available,recommended,vat_rate) select id,'PERRITO','',5.00,true,false,10 from public.categories where name='BOCADILLOS';
insert into public.products(category_id,name,description,price,available,recommended,vat_rate) select id,'PERRITO CON QUESO','',5.40,true,false,10 from public.categories where name='BOCADILLOS';
insert into public.products(category_id,name,description,price,available,recommended,vat_rate) select id,'PERRITO CON JAMÓN Y QUESO','',5.70,true,false,10 from public.categories where name='BOCADILLOS';
insert into public.products(category_id,name,description,price,available,recommended,vat_rate) select id,'PERRITO CON BACON Y QUESO','',5.70,true,false,10 from public.categories where name='BOCADILLOS';
insert into public.products(category_id,name,description,price,available,recommended,vat_rate) select id,'PERRITO COMPLETO (QUESO, YORK Y VEGETALES)','',6.00,true,false,10 from public.categories where name='BOCADILLOS';
insert into public.products(category_id,name,description,price,available,recommended,vat_rate) select id,'1º PECHUGA CON QUESO, HUEVO Y TOMATE','',6.30,true,false,10 from public.categories where name='BOCADILLOS ESPECIALES EN PAN BLANDO';
insert into public.products(category_id,name,description,price,available,recommended,vat_rate) select id,'2º PECHUGA REBOZADA CON QUESO, HUEVO Y TOMATE','',6.70,true,false,10 from public.categories where name='BOCADILLOS ESPECIALES EN PAN BLANDO';
insert into public.products(category_id,name,description,price,available,recommended,vat_rate) select id,'3º PINCHOS CON QUESO','',6.30,true,false,10 from public.categories where name='BOCADILLOS ESPECIALES EN PAN BLANDO';
insert into public.products(category_id,name,description,price,available,recommended,vat_rate) select id,'4º JAMÓN ASADO CON QUESO','',5.90,true,false,10 from public.categories where name='BOCADILLOS ESPECIALES EN PAN BLANDO';
insert into public.products(category_id,name,description,price,available,recommended,vat_rate) select id,'5º VEGETAL','',5.90,true,false,10 from public.categories where name='BOCADILLOS ESPECIALES EN PAN BLANDO';
insert into public.products(category_id,name,description,price,available,recommended,vat_rate) select id,'SANDWICH MIXTO','',4.50,true,false,10 from public.categories where name='SANDWICHES';
insert into public.products(category_id,name,description,price,available,recommended,vat_rate) select id,'SANDWICH VEGETAL CON ESPÁRRAGOS','',5.30,true,false,10 from public.categories where name='SANDWICHES';
insert into public.products(category_id,name,description,price,available,recommended,vat_rate) select id,'SANDWICH ESPECIAL','',5.50,true,false,10 from public.categories where name='SANDWICHES';
insert into public.products(category_id,name,description,price,available,recommended,vat_rate) select id,'SANDWICH POLLO','',5.80,true,false,10 from public.categories where name='SANDWICHES';
insert into public.products(category_id,name,description,price,available,recommended,vat_rate) select id,'SANDWICH TRIPLE','',6.50,true,false,10 from public.categories where name='SANDWICHES';
insert into public.products(category_id,name,description,price,available,recommended,vat_rate) select id,'HAMBURGUESA SIMPLE','',4.50,true,false,10 from public.categories where name='HAMBURGUESAS';
insert into public.products(category_id,name,description,price,available,recommended,vat_rate) select id,'HAMBURGUESA SIMPLE CON QUESO','',4.90,true,false,10 from public.categories where name='HAMBURGUESAS';
insert into public.products(category_id,name,description,price,available,recommended,vat_rate) select id,'HAMBURGUESA SIMPLE CON QUESO Y BACON','',5.40,true,false,10 from public.categories where name='HAMBURGUESAS';
insert into public.products(category_id,name,description,price,available,recommended,vat_rate) select id,'HAMBURGUESA COMPLETA','',5.50,true,false,10 from public.categories where name='HAMBURGUESAS';
insert into public.products(category_id,name,description,price,available,recommended,vat_rate) select id,'HAMBURGUESA ESPECIAL','',5.90,true,false,10 from public.categories where name='HAMBURGUESAS';
insert into public.products(category_id,name,description,price,available,recommended,vat_rate) select id,'HAMBURGUESA SOHO','',6.40,true,true,10 from public.categories where name='HAMBURGUESAS';
insert into public.products(category_id,name,description,price,available,recommended,vat_rate) select id,'DOBLE DE TERNERA','',8.90,true,false,10 from public.categories where name='HAMBURGUESAS PREMIUM';
insert into public.products(category_id,name,description,price,available,recommended,vat_rate) select id,'ANGUS','Queso de Arzúa, cebolla caramelizada y bacon en pan de burger.',8.90,true,false,10 from public.categories where name='HAMBURGUESAS PREMIUM';
insert into public.products(category_id,name,description,price,available,recommended,vat_rate) select id,'VEGETAL','',8.90,true,false,10 from public.categories where name='HAMBURGUESAS PREMIUM';
insert into public.products(category_id,name,description,price,available,recommended,vat_rate) select id,'DE VACA VIEJA','',8.90,true,false,10 from public.categories where name='HAMBURGUESAS PREMIUM';
insert into public.products(category_id,name,description,price,available,recommended,vat_rate) select id,'CRISPY SOHO','',7.90,true,false,10 from public.categories where name='HAMBURGUESAS PREMIUM';
insert into public.products(category_id,name,description,price,available,recommended,vat_rate) select id,'TOSTA DE GAMBAS CON ALIOLI','',8.40,true,false,10 from public.categories where name='TOSTAS';
insert into public.products(category_id,name,description,price,available,recommended,vat_rate) select id,'TOSTA DE POLLO Y BACON','',7.10,true,false,10 from public.categories where name='TOSTAS';
insert into public.products(category_id,name,description,price,available,recommended,vat_rate) select id,'TOSTA DE JAMÓN CON TOMATE','',5.50,true,false,10 from public.categories where name='TOSTAS';
insert into public.products(category_id,name,description,price,available,recommended,vat_rate) select id,'TOSTA DE PULPO CON QUESO DE TETILLA','',12.50,true,false,10 from public.categories where name='TOSTAS';
insert into public.products(category_id,name,description,price,available,recommended,vat_rate) select id,'ESPAGUETI BOLOÑESA','',9.50,true,false,10 from public.categories where name='PASTAS';
insert into public.products(category_id,name,description,price,available,recommended,vat_rate) select id,'ESPAGUETI CARBONARA','',9.50,true,false,10 from public.categories where name='PASTAS';
insert into public.products(category_id,name,description,price,available,recommended,vat_rate) select id,'NUGGETS DE POLLO','',6.90,true,false,10 from public.categories where name='NUGGETS Y FINGERS';
insert into public.products(category_id,name,description,price,available,recommended,vat_rate) select id,'FINGERS DE POLLO','',6.90,true,false,10 from public.categories where name='NUGGETS Y FINGERS';
insert into public.products(category_id,name,description,price,available,recommended,vat_rate) select id,'1º PECHUGA + TORTILLA FRANCESA + PATATA O ENSALADA','',9.30,true,false,10 from public.categories where name='PLATOS COMBINADOS ESTILO MIRO PEREIRA';
insert into public.products(category_id,name,description,price,available,recommended,vat_rate) select id,'2º MILANESA + HUEVOS FRITOS + PATATAS','',9.90,true,false,10 from public.categories where name='PLATOS COMBINADOS ESTILO MIRO PEREIRA';
insert into public.products(category_id,name,description,price,available,recommended,vat_rate) select id,'3º LOMITOS + PIMIENTOS + PATATAS O ARROZ','',9.90,true,false,10 from public.categories where name='PLATOS COMBINADOS ESTILO MIRO PEREIRA';
insert into public.products(category_id,name,description,price,available,recommended,vat_rate) select id,'4º HUEVOS FRITOS + SALCHICHAS + PATATAS O ARROZ','',8.90,true,false,10 from public.categories where name='PLATOS COMBINADOS ESTILO MIRO PEREIRA';
insert into public.products(category_id,name,description,price,available,recommended,vat_rate) select id,'5º PEPITO + HUEVOS FRITOS + PATATAS','',10.90,true,false,10 from public.categories where name='PLATOS COMBINADOS ESTILO MIRO PEREIRA';
insert into public.products(category_id,name,description,price,available,recommended,vat_rate) select id,'6º NUGGETS + CROQUETAS + PATATAS O ARROZ','',9.10,true,false,10 from public.categories where name='PLATOS COMBINADOS ESTILO MIRO PEREIRA';
insert into public.products(category_id,name,description,price,available,recommended,vat_rate) select id,'7º PINCHOS + HUEVOS FRITOS + PATATAS O ARROZ','',9.90,true,false,10 from public.categories where name='PLATOS COMBINADOS ESTILO MIRO PEREIRA';
insert into public.products(category_id,name,description,price,available,recommended,vat_rate) select id,'8º CARNE SOHO + PATATAS Y PIMIENTOS','',9.50,true,false,10 from public.categories where name='PLATOS COMBINADOS ESTILO MIRO PEREIRA';
insert into public.products(category_id,name,description,price,available,recommended,vat_rate) select id,'9º PLATO COMBINADO CON JAMÓN ASADO','',9.50,true,false,10 from public.categories where name='PLATOS COMBINADOS ESTILO MIRO PEREIRA';
insert into public.products(category_id,name,description,price,available,recommended,vat_rate) select id,'10º HAMBURGUESA + HUEVOS FRITOS + PATATAS O ARROZ','',8.90,true,false,10 from public.categories where name='PLATOS COMBINADOS ESTILO MIRO PEREIRA';
insert into public.products(category_id,name,description,price,available,recommended,vat_rate) select id,'PATATAS SOLAS','',4.90,true,false,10 from public.categories where name='RACIONES DE PATATAS FRITAS';
insert into public.products(category_id,name,description,price,available,recommended,vat_rate) select id,'PATATAS BRAVAS','',5.40,true,false,10 from public.categories where name='RACIONES DE PATATAS FRITAS';
insert into public.products(category_id,name,description,price,available,recommended,vat_rate) select id,'PATATAS ALIOLI','',5.40,true,false,10 from public.categories where name='RACIONES DE PATATAS FRITAS';
insert into public.products(category_id,name,description,price,available,recommended,vat_rate) select id,'PATATAS SOHO (BACON Y QUESO)','',5.90,true,false,10 from public.categories where name='RACIONES DE PATATAS FRITAS';
insert into public.products(category_id,name,description,price,available,recommended,vat_rate) select id,'NORMAL','',5.90,true,false,10 from public.categories where name='ENSALADAS';
insert into public.products(category_id,name,description,price,available,recommended,vat_rate) select id,'MIXTA','',7.90,true,false,10 from public.categories where name='ENSALADAS';
insert into public.products(category_id,name,description,price,available,recommended,vat_rate) select id,'SOHO','',7.90,true,false,10 from public.categories where name='ENSALADAS';
insert into public.products(category_id,name,description,price,available,recommended,vat_rate) select id,'FRESA Y PIÑA','',9.50,true,false,10 from public.categories where name='ENSALADAS';
insert into public.products(category_id,name,description,price,available,recommended,vat_rate) select id,'GAMBAS','',9.90,true,false,10 from public.categories where name='ENSALADAS';
insert into public.products(category_id,name,description,price,available,recommended,vat_rate) select id,'DE MANGO','',9.90,true,false,10 from public.categories where name='ENSALADAS';
insert into public.products(category_id,name,description,price,available,recommended,vat_rate) select id,'CÉSAR','',8.90,true,false,10 from public.categories where name='ENSALADAS';
insert into public.products(category_id,name,description,price,available,recommended,vat_rate) select id,'DE PASTA','',8.90,true,false,10 from public.categories where name='ENSALADAS';
insert into public.products(category_id,name,description,price,available,recommended,vat_rate) select id,'ZUMO NATURAL NARANJA','',2.60,true,false,10 from public.categories where name='PARA DESAYUNAR';
insert into public.products(category_id,name,description,price,available,recommended,vat_rate) select id,'TOSTADAS CON MANTEQUILLA Y MERMELADA','',1.60,true,false,10 from public.categories where name='PARA DESAYUNAR';
insert into public.products(category_id,name,description,price,available,recommended,vat_rate) select id,'TOSTADAS DE PAN DE BARRA (ACEITE DE OLIVA Y TOMATE NATURAL RALLADO)','',2.20,true,false,10 from public.categories where name='PARA DESAYUNAR';
insert into public.products(category_id,name,description,price,available,recommended,vat_rate) select id,'HUEVOS REVUELTOS','',2.50,true,false,10 from public.categories where name='PARA DESAYUNAR';
insert into public.products(category_id,name,description,price,available,recommended,vat_rate) select id,'HUEVOS REVUELTOS CON BACON','',3.50,true,false,10 from public.categories where name='PARA DESAYUNAR';
insert into public.products(category_id,name,description,price,available,recommended,vat_rate) select id,'TORTILLA FRANCESA','',2.50,true,false,10 from public.categories where name='PARA DESAYUNAR';
insert into public.products(category_id,name,description,price,available,recommended,vat_rate) select id,'TORTILLA FRANCESA CON JAMÓN Y QUESO','',3.50,true,false,10 from public.categories where name='PARA DESAYUNAR';
insert into public.products(category_id,name,description,price,available,recommended,vat_rate) select id,'CAFÉ O INFUSIÓN CON · OPCIÓN 4,90 €','',4.90,true,false,10 from public.categories where name='PREPARA TU COMBI DESAYUNO';
insert into public.products(category_id,name,description,price,available,recommended,vat_rate) select id,'CAFÉ O INFUSIÓN CON · OPCIÓN 5,90 €','',5.90,true,false,10 from public.categories where name='PREPARA TU COMBI DESAYUNO';


-- Bebidas. Los precios de Coca-Cola, Aquarius, agua y Estrella se deducen de pedidos reales aportados por SOHO.
-- Fanta, Nestea y Kas usan el precio de su grupo de refrescos y deben confirmarse con el local antes de publicar en producción.
insert into public.products(category_id,name,description,price,available,recommended,vat_rate,image_url) select id,'COCA-COLA','Lata 33 cl.',1.55,true,false,21,'/beverages/coca-cola.svg' from public.categories where name='BEBIDAS';
insert into public.products(category_id,name,description,price,available,recommended,vat_rate,image_url) select id,'COCA-COLA ZERO','Lata 33 cl.',1.55,true,false,21,'/beverages/coca-cola-zero.svg' from public.categories where name='BEBIDAS';
insert into public.products(category_id,name,description,price,available,recommended,vat_rate,image_url) select id,'COCA-COLA ZERO ZERO','Lata 33 cl.',1.55,true,false,21,'/beverages/coca-cola-zero-zero.svg' from public.categories where name='BEBIDAS';
insert into public.products(category_id,name,description,price,available,recommended,vat_rate,image_url) select id,'FANTA NARANJA','Lata 33 cl.',1.55,true,false,21,'/beverages/fanta-naranja.svg' from public.categories where name='BEBIDAS';
insert into public.products(category_id,name,description,price,available,recommended,vat_rate,image_url) select id,'FANTA LIMÓN','Lata 33 cl.',1.55,true,false,21,'/beverages/fanta-limon.svg' from public.categories where name='BEBIDAS';
insert into public.products(category_id,name,description,price,available,recommended,vat_rate,image_url) select id,'NESTEA LIMÓN','Lata 33 cl.',2.15,true,false,21,'/beverages/nestea-limon.svg' from public.categories where name='BEBIDAS';
insert into public.products(category_id,name,description,price,available,recommended,vat_rate,image_url) select id,'AQUARIUS LIMÓN','Lata 33 cl.',2.15,true,false,21,'/beverages/aquarius-limon.svg' from public.categories where name='BEBIDAS';
insert into public.products(category_id,name,description,price,available,recommended,vat_rate,image_url) select id,'AQUARIUS NARANJA','Lata 33 cl.',2.15,true,false,21,'/beverages/aquarius-naranja.svg' from public.categories where name='BEBIDAS';
insert into public.products(category_id,name,description,price,available,recommended,vat_rate,image_url) select id,'KAS NARANJA','Lata 33 cl.',1.55,true,false,21,'/beverages/kas-naranja.svg' from public.categories where name='BEBIDAS';
insert into public.products(category_id,name,description,price,available,recommended,vat_rate,image_url) select id,'KAS LIMÓN','Lata 33 cl.',1.55,true,false,21,'/beverages/kas-limon.svg' from public.categories where name='BEBIDAS';
insert into public.products(category_id,name,description,price,available,recommended,vat_rate,image_url) select id,'SPRITE / 7UP','Lata 33 cl.',1.55,true,false,21,'/beverages/sprite-7up.svg' from public.categories where name='BEBIDAS';
insert into public.products(category_id,name,description,price,available,recommended,vat_rate,image_url) select id,'AGUA','Botella 50 cl.',1.45,true,false,10,'/beverages/agua.svg' from public.categories where name='BEBIDAS';
insert into public.products(category_id,name,description,price,available,recommended,vat_rate,image_url) select id,'AGUA CON GAS','Botella individual.',1.45,true,false,10,'/beverages/agua-gas.svg' from public.categories where name='BEBIDAS';
insert into public.products(category_id,name,description,price,available,recommended,vat_rate,image_url) select id,'ESTRELLA GALICIA','Botellín o lata individual.',2.65,true,false,21,'/beverages/estrella-galicia.svg' from public.categories where name='BEBIDAS';

-- Imágenes representativas coherentes por tipo de producto. Se sirven desde Unsplash.
update public.products as p
set image_url = case
  when c.name='BEBIDAS' then p.image_url
  when upper(p.name) like '%PULPO%' then 'https://images.unsplash.com/photo-1559339352-11d035aa65de?auto=format&fit=crop&w=1200&q=82'
  when upper(p.name) like '%CALAMAR%' or upper(p.name) like '%GAMBA%' then 'https://images.unsplash.com/photo-1565680018434-b513d5e5fd47?auto=format&fit=crop&w=1200&q=82'
  when upper(p.name) like '%CARBONARA%' then 'https://images.unsplash.com/photo-1473093295043-cdd812d0e601?auto=format&fit=crop&w=1200&q=82'
  when upper(p.name) like '%BOLOÑESA%' or upper(p.name) like '%PASTA%' then 'https://images.unsplash.com/photo-1556761223-4c4282c73f77?auto=format&fit=crop&w=1200&q=82'
  when upper(p.name) like '%NUGGET%' or upper(p.name) like '%FINGER%' or upper(p.name) like '%CRISPY%' then 'https://images.unsplash.com/photo-1562967914-608f82629710?auto=format&fit=crop&w=1200&q=82'
  when upper(p.name) like '%PATATA%' then 'https://images.unsplash.com/photo-1573080496219-bb080dd4f877?auto=format&fit=crop&w=1200&q=82'
  when upper(p.name) like '%ENSALAD%' or c.name='ENSALADAS' then 'https://images.unsplash.com/photo-1546793665-c74683f339c1?auto=format&fit=crop&w=1200&q=82'
  when upper(p.name) like '%ZUMO%' then 'https://images.unsplash.com/photo-1600271886742-f049cd451bba?auto=format&fit=crop&w=1200&q=82'
  when c.name in ('PARA DESAYUNAR','PREPARA TU COMBI DESAYUNO') then 'https://images.unsplash.com/photo-1533089860892-a7c6f0a88666?auto=format&fit=crop&w=1200&q=82'
  when c.name='TOSTAS' then 'https://images.unsplash.com/photo-1541519227354-08fa5d50c44d?auto=format&fit=crop&w=1200&q=82'
  when upper(p.name) like '%PERRITO%' then 'https://images.unsplash.com/photo-1612392062631-94dd858cba88?auto=format&fit=crop&w=1200&q=82'
  when c.name='SANDWICHES' then 'https://images.unsplash.com/photo-1528735602780-2552fd46c7af?auto=format&fit=crop&w=1200&q=82'
  when c.name like 'HAMBURGUESAS%' then 'https://images.unsplash.com/photo-1568901346375-23c9450c58cd?auto=format&fit=crop&w=1200&q=82'
  when upper(p.name) like '%PECHUGA%' or upper(p.name) like '%POLLO%' then 'https://images.unsplash.com/photo-1532550907401-a500c9a57435?auto=format&fit=crop&w=1200&q=82'
  when upper(p.name) like '%LOMO%' or upper(p.name) like '%PEPITO%' or upper(p.name) like '%JAMÓN ASADO%' then 'https://images.unsplash.com/photo-1558030006-450675393462?auto=format&fit=crop&w=1200&q=82'
  when upper(p.name) like '%BACON%' then 'https://images.unsplash.com/photo-1528607929212-2636ec44253e?auto=format&fit=crop&w=1200&q=82'
  when upper(p.name) like '%TORTILLA%' or upper(p.name) like '%HUEVO%' then 'https://images.unsplash.com/photo-1525351484163-7529414344d8?auto=format&fit=crop&w=1200&q=82'
  else 'https://images.unsplash.com/photo-1504674900247-0877df9cc836?auto=format&fit=crop&w=1200&q=82'
end
from public.categories as c
where p.category_id = c.id;

update public.business_settings set opening_time='09:00', closing_time='01:00', minimum_order=0, admin_email='cambadossoho@gmail.com', fiscal_name='SOHO Cambados', fiscal_address='Calle A Mariña, 3, 36630 Cambados, Pontevedra', weekly_hours='{"0":{"open":"10:00","close":"01:00","closed":false},"1":{"open":"09:00","close":"01:00","closed":false},"2":{"open":"09:00","close":"01:00","closed":false},"3":{"open":"09:00","close":"01:00","closed":false},"4":{"open":"09:00","close":"01:00","closed":false},"5":{"open":"09:00","close":"01:00","closed":false},"6":{"open":"10:00","close":"01:00","closed":false}}'::jsonb where id='main';
commit;
