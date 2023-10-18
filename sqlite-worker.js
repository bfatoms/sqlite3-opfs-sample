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

  const test = await db.exec({
    sql: "CREATE TABLE IF NOT EXISTS users (id INTEGER primary key, name TEXT, age INTEGER)",
  });

  const ins = await db.exec({
    sql: "INSERT OR IGNORE INTO users (id, name, age) values (1, 'Louie', 33),(2, 'Louie', 33),(3, 'Louie', 34),(4, 'Louie', 35),(5, 'Louie', 34),(6, 'Louie', 35)",
    rowMode: 'object',
  });

  const result = await db.exec({
    sql: "SELECT * FROM users WHERE age > '33' AND name = 'Louie'",
    rowMode: 'object',
    returnValue: "resultRows",
  });

  // console.log(result);

  if (debug) { console.log(message, db.filename); }
  return { success: true, data: { name: db.filename } };
};

const raw = async (query) => {
  // console.log(db.exec('select * from users;'))
  // console.log(db);
  console.log("exec");
  const result = await db.exec({
    sql: query,
    rowMode: 'object',
    returnValue: 'resultRows'
  });
  console.log("exec",result);
  return result;
  // return await db.exec(query);
}

// received messages from the caller
self.onmessage = async (event) => {
  switch (event.data[0]) {
    case 'initialize':
      // initialize(event.data[1]);
      const data = await initialize(event.data[1]);
      if(debug) { console.log(data.success, data.data); }
      // send message to the caller
      self.postMessage(['response', data]);
      break;
    case 'execute':
      // console.log(event.data[1].sql);
      const result = await raw(event.data[1].sql);
      // console.log(result);
      self.postMessage(['response', {success: true, data: result}]);
      break;
  }
}
