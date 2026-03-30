
-- CCC1472
UPDATE orders SET
  sender = jsonb_set(jsonb_set(jsonb_set(jsonb_set(sender, '{email}', '"nickysnutch@gmail.com"'), '{phone}', '"+447557643429"'), '{address,street}', '"35 Colemere Drive, Thingwall"'), '{address,city}', '"Wirral"'),
  receiver = jsonb_set(jsonb_set(jsonb_set(jsonb_set(receiver, '{email}', '"npl2@outlook.com"'), '{phone}', '"+447946138857"'), '{address,street}', '"49 Portesham Way"'), '{address,city}', '"Poole"')
WHERE customer_order_number = 'CCC1472' AND id = 'b6d82438-b84d-41bc-b57d-99d78970179e';

-- CCC1473
UPDATE orders SET
  sender = jsonb_set(jsonb_set(jsonb_set(jsonb_set(sender, '{email}', '"brookstony@400gmail.com"'), '{phone}', '"+447996373357"'), '{address,street}', '"Holly House, Medburn"'), '{address,city}', '"Newcastle"'),
  receiver = jsonb_set(jsonb_set(jsonb_set(jsonb_set(receiver, '{email}', '"robert.fletcher@kajima.co.uk"'), '{phone}', '"+447896621539"'), '{address,street}', '"6 Montgomery Crescent"'), '{address,city}', '"Milton Keynes"')
WHERE customer_order_number = 'CCC1473' AND id = '0fc1532d-9b98-485f-802d-473d5b6c8a66';

-- CCC1474
UPDATE orders SET
  sender = jsonb_set(jsonb_set(jsonb_set(jsonb_set(sender, '{email}', '"robski1@yahoo.com"'), '{phone}', '"+447876755305"'), '{address,street}', '"9 Glynswood"'), '{address,city}', '"Farnham"'),
  receiver = jsonb_set(jsonb_set(jsonb_set(jsonb_set(receiver, '{email}', '"robski1@yahoo.com"'), '{phone}', '"+447944508935"'), '{address,street}', '"11 Elmroyd Avenue"'), '{address,city}', '"Potters Bar"')
WHERE customer_order_number = 'CCC1474' AND id = '25169cbe-84d3-4057-b1b6-e99864f31f27';

-- CCC1475
UPDATE orders SET
  sender = jsonb_set(jsonb_set(jsonb_set(jsonb_set(sender, '{email}', '"richard.james.jackson93@gmail.com"'), '{phone}', '"+447494985934"'), '{address,street}', '"1 Station Road, Whixley"'), '{address,city}', '"York"'),
  receiver = jsonb_set(jsonb_set(jsonb_set(jsonb_set(receiver, '{email}', '"richard.james.jackson93@gmail.com"'), '{phone}', '"+447494985934"'), '{address,street}', '"3 Manor Road, Bishopston"'), '{address,city}', '"Bristol"')
WHERE customer_order_number = 'CCC1475' AND id = '75a94ae6-fb51-4f31-a256-fd1f1d4baad3';

-- CCC1476
UPDATE orders SET
  sender = jsonb_set(jsonb_set(jsonb_set(jsonb_set(sender, '{email}', '"whitmorem@outlook.com"'), '{phone}', '"+447952903208"'), '{address,street}', '"9 Maes y Rhedyn"'), '{address,city}', '"Talbot Green"'),
  receiver = jsonb_set(jsonb_set(jsonb_set(jsonb_set(receiver, '{email}', '"shaw.l@hotmail.co.uk"'), '{phone}', '"+447900868886"'), '{address,street}', '"5b Curwen Road"'), '{address,city}', '"London"')
WHERE customer_order_number = 'CCC1476' AND id = 'd6194a45-c8b9-431e-8adf-9901fc12d482';
