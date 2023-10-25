class Database {
  constructor(worker) {

    if (Database.instance) {
      return Database.instance
    }

    this.query = {
      table: null,
      conditions: [],
    };

    this.worker = worker;
    Database.instance = this;
  }

  static async initialize() {
    if (Database.instance) {
      return Database.instance
    }
    let sqworker = new Worker(new URL("./sqlite-worker.js", import.meta.url), { type: "module" });
    Database.instance = new Database(sqworker);
    await Database.instance.sendToWorker(['initialize', { name: 'dobby.sqlite', debug: true }]);
    return Database.instance;
  }

  async sendToWorker(message) {
    return new Promise((resolve, reject) => {
      const onError = (error) => {
        this.worker.removeEventListener('error', onError);
        reject(error);
      };

      this.worker.addEventListener('error', onError);
      this.worker.postMessage(message);

      this.worker.addEventListener('message', (event) => {
        if (event.data[0] === 'response') {
          this.worker.removeEventListener('error', onError);
          resolve(event.data[1]);
        }
      });
    });
  }

  async execute(sql) {
    return await this.sendToWorker(['execute', { sql }]);
  }

  from(tableName) {
    this.query.conditions = [];
    this.query.table = tableName;
    return this;
  }

  where(column, operator, value) {
    if (typeof column === 'function') {
      // Subquery
      const subquery = new Database(this.worker);
      column(subquery);
      const subquerySQL = subquery.buildQuery();
      this.query.conditions.push(`(${subquerySQL})`);
    } else {
      this.query.conditions.push({ column, operator, value });
    }
    return this;
  }

  orWhere(column, operator, value) {
    if (this.query.conditions.length === 0) {
      throw new Error("No previous 'where' condition to combine with 'orWhere'.");
    }
    this.query.conditions.push('OR');
    this.query.conditions.push({ column, operator, value });
    return this;
  }

  where(column, operator, value) {
    this.query.conditions.push({ column, operator, value });
    return this;
  }

  groupBy(column) {
    this.query.groupBy = column;
    return this;
  }

  having(column, operator, value) {
    this.query.having = { column, operator, value };
    return this;
  }

  async get() {
    const sql = this.buildQuery();
    console.log(sql);
    return await this.execute(sql);
  }

  async find(id) {
    if (!this.query.table) {
      throw new Error("Table name not specified. Call 'from' method first.");
    }

    this.query.conditions = [{ column: 'id', operator: '=', value: id }];

    const sql = this.buildQuery();

    const result = await this.execute(sql);

    return { result: result.success, data: result.data[0] };
  }

  to(tableName) {
    this.query.table = tableName;
    return this;
  }

  // New method to create a new record
  async create(data) {
    console.log(data);
    if (!this.query.table) {
      throw new Error("Table name not specified. Call 'to' method first.");
    }
    const columns = Object.keys(data);
    const values = Object.values(data);
    const columnString = columns.join(', ');
    const valuePlaceholders = columns.map(() => '?').join(', ');
    const sql = `INSERT INTO ${this.query.table} (${columnString}) VALUES (${valuePlaceholders}) returning *`;
    const result = await this.execute({ sql, params: values });
    return { result: result.success, data: result.data[0] };
  }

  // New method to update an existing record by ID
  async update(id, data) {
    if (!this.query.table) {
      throw new Error("Table name not specified. Call 'to' method first.");
    }
    const columns = Object.keys(data);
    const values = Object.values(data);
    const updates = columns.map((column) => `${column} = ?`).join(', ');
    const sql = `UPDATE ${this.query.table} SET ${updates} WHERE id = ? returning *`;
    const result = await this.execute({ sql, params: [...values, id] });
    return { result: result.success, data: result.data[0] };
  }

  // New method to delete a record by ID
  async delete(id) {
    if (!this.query.table) {
      throw new Error("Table name not specified. Call 'to' method first.");
    }

    const sql = `DELETE FROM ${this.query.table} WHERE id = ?`;
    const result = await this.execute({ sql, params: [id] });
    return { result: result.success, data: result.data[0] };
  }

  buildQuery() {
    let sql = `SELECT * FROM ${this.query.table}`;

    if (this.query.conditions.length > 0) {
      sql += ' WHERE ';
      for (const condition of this.query.conditions) {
        sql += `${condition.column} ${condition.operator} '${condition.value}' AND `;
      }
      // Remove the trailing ' AND '
      sql = sql.slice(0, -5);
    }

    return sql;
  }

  toQuery() {
    const sql = this.buildQuery();
    const bindings = this.query.conditions
      .filter((condition) => typeof condition !== 'string')
      .map((condition) => condition.value);

    const queryWithValues = sql.replace(/\?/g, (match) => {
      const value = bindings.shift();
      if (typeof value === 'string') {
        return `'${value}'`;
      }
      return value;
    });

    return queryWithValues;
  }

  async paginate(perPage, page = 1) {
    if (!this.query.table) {
      throw new Error("Table name not specified. Call 'from' method first.");
    }

    if (!perPage || isNaN(perPage) || perPage <= 0) {
      throw new Error("Invalid 'perPage' value.");
    }

    if (!page || isNaN(page) || page <= 0) {
      throw new Error("Invalid 'page' value.");
    }

    const offset = (page - 1) * perPage;

    const sql = this.buildQuery() + ` LIMIT ${perPage} OFFSET ${offset}`;
    const result = await this.execute(sql);

    return {
      current_page: page,
      per_page: perPage,
      total: result.data?.length || 0,
      data: result.data,
    };
  }


  // added here so that we don't need to install more dependencies?
  generateUUID = () => {
    let
      d = new Date().getTime(),
      d2 = ((typeof performance !== 'undefined') && performance.now && (performance.now() * 1000)) || 0;
    return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, c => {
      let r = Math.random() * 16;
      if (d > 0) {
        r = (d + r) % 16 | 0;
        d = Math.floor(d / 16);
      } else {
        r = (d2 + r) % 16 | 0;
        d2 = Math.floor(d2 / 16);
      }
      return (c == 'x' ? r : (r & 0x7 | 0x8)).toString(16);
    });
  };

}

// console.log(navigator.userAgent.includes('Chrome'));

console.time('initialize db');
const db = await Database.initialize();
console.timeEnd('initialize db');

// select
console.time('select specific users via get()');
let results = await db.from('users').where('id', '=', '1a5ec39c-f1fd-495b-9346-e1a47ea7d683').get();
console.timeEnd('select specific users via get()');
console.log(results);

console.time('select specific users via find()');
let results2 = await db.from('users').find('1a5ec39c-f1fd-495b-9346-e1a47ea7d682');
console.timeEnd('select specific users via find()');
console.log(results2);

// create
console.time('create a user');
let results3 = await db.to('users').create({ "id": db.generateUUID(), "name": "Charlene", "age": "29" });
console.timeEnd('create a user');
console.log("create", results3);

console.time('select all users via get()');
let results4 = await db.from('users').get();
console.timeEnd('select all users via get()');
console.log("all users: ", results4);

// update
console.time('update a user');
let result5 = await db.to('users').update('1a5ec39c-f1fd-495b-9346-e1a47ea7d682', { "name": "Mang Tomas", "age": "34" });
console.timeEnd('update a user');
console.log("update", result5);
// console.log(user);

// create user then delete it..
const new_id = db.generateUUID();
await db.to('users').create({ "id": new_id, "name": "Louie Pogi", "age": "19" });
// delete
console.time('delete a user by its id');
let results9 = await db.to('users').delete(new_id);
console.timeEnd('delete a user by its id');
console.log("delete: ", results9);

// create another instance but it should only get the same instance because its singleton
let db2 = await Database.initialize();

let user1 = await db2.from('users').find('1a5ec39c-f1fd-495b-9346-e1a47ea7d682');
console.log(user1);

console.time('users paginated');
const paginated_users = await db2.from('users').paginate(20);
console.timeEnd('users paginated');
console.log('paginated users:', paginated_users);

console.time('orders paginated');
const paginated_orders = await db2.from('orders').paginate(20);
console.timeEnd('orders paginated');
console.log('paginated orders: ', paginated_orders);

