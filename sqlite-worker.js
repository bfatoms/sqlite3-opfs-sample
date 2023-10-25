import sqlite3InitModule from '@sqlite.org/sqlite-wasm';

let db;

let debug = false;

const initialize = async (init) => {
  debug = init.debug ?? false;
  if (debug) { console.log('filename', init.name); }
  let message = '';
  const sqlite3 = await sqlite3InitModule({
    print: console.log,
    printErr: console.error,
  });

  if ('opfs' in sqlite3) {
    db = new sqlite3.oo1.OpfsDb(init.name);
    message = 'OPFS is available, created persisted database at';
  } else {
    db = new sqlite3.oo1.DB(init.name, 'ct');
    message = 'OPFS is not available, created transient database';
  }

  console.time('create_users_table');
  await db.exec({
    sql: "CREATE TABLE IF NOT EXISTS users (id UUID primary key, name TEXT, age INTEGER)",
  });
  console.timeEnd('create_users_table');

  console.time('create_orders_table');
  await db.exec({
    sql: "CREATE TABLE IF NOT EXISTS orders (id UUID primary key, type string, order_number string unique)",
  });
  console.timeEnd('create_orders_table');

  console.time('insert_users');
  await db.exec({
    sql: "INSERT OR IGNORE INTO users (id, name, age) values ('1a5ec39c-f1fd-495b-9346-e1a47ea7d682', 'Louie', 33),('1a5ec39c-f1fd-495b-9346-e1a47ea7d683', 'Louie', 33),('1a5ec39c-f1fd-495b-9346-e1a47ea7d684', 'Louie', 34),('1a5ec39c-f1fd-495b-9346-e1a47ea7d685', 'Louie', 35),('1a5ec39c-f1fd-495b-9346-e1a47ea7d686', 'Louie', 34),('1a5ec39c-f1fd-495b-9346-e1a47ea7d687', 'Louie', 35)",
    rowMode: 'object',
  });
  console.timeEnd('insert_users');

  console.time('insert_orders');
  await db.exec({
    sql: "INSERT OR IGNORE INTO orders (id, type, order_number) values ('1a5ec39c-f1fd-495b-9346-e1a47ea7d682', 'SALES_ORDER', 'SO-1'),('1a5ec39c-f1fd-495b-9346-e1a47ea7d683', 'SALES_ORDER', 'SO-2'),('1a5ec39c-f1fd-495b-9346-e1a47ea7d683', 'SALES_ORDER', 'SO-3'),('1a5ec39c-f1fd-495b-9346-e1a47ea7d685', 'SALES_ORDER', 'SO-4'),('1a5ec39c-f1fd-495b-9346-e1a47ea7d686', 'SALES_ORDER', 'SO-5'),('1a5ec39c-f1fd-495b-9346-e1a47ea7d687', 'SALES_ORDER', 'SO-6')",
    rowMode: 'object',
  });
  console.timeEnd('insert_orders');

  console.time('select_users');
  const users = await db.exec({
    sql: "SELECT * FROM users",
    rowMode: 'object',
    returnValue: "resultRows",
  });
  console.timeEnd('select_users');
  console.log("USERS: ", users);


  console.time('select_users');
  const orders = await db.exec({
    sql: "SELECT * FROM orders",
    rowMode: 'object',
    returnValue: "resultRows",
  });
  console.timeEnd('select_users');

  console.log("ORDERS: ", orders);

  if (debug) { console.log(message, db.filename); }
  return { success: true, data: { name: db.filename } };
};

const raw = async (q) => {
  let query = q.sql ?? q;
  let params = q.params ?? [];
  let result;
  try {
    result = await db.exec({
      sql: query,
      rowMode: 'object',
      bind: params,
      returnValue: 'resultRows'
    });
  }
  catch (err) {
    console.log(err);
  }

  return result;
}

// received messages from the caller
self.onmessage = async (event) => {
  switch (event.data[0]) {
    case 'initialize':
      // initialize(event.data[1]);
      const data = await initialize(event.data[1]);
      if (debug) { console.log(data.success, data.data); }
      // send message to the caller
      self.postMessage(['response', data]);
      break;
    case 'execute':
      // console.log(event.data[1].sql);
      const result = await raw(event.data[1].sql);
      // console.log(result);
      self.postMessage(['response', { success: true, data: result }]);
      break;
  }
}
