class Database {
  constructor() {
    this.query = {
      table: null,
      conditions: [],
    };

    if (window.Worker) {
      this.worker = new Worker(new URL("./sqlite-worker.js", import.meta.url), { type: "module" });
    } else {
      console.log("Your browser doesn't support web workers.");
    }
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

  async initialize() {
    return await this.sendToWorker(['initialize', { name: 'dobby.sqlite', debug: true }]);
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
    this.query.conditions.push({ column, operator, value });
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

    return {result: result.success, data: result.data[0]};
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
}

const db = new Database();
await db.initialize();
let results = await db.from('users').where('id', '=', 1).get();
console.log(results);


// results = await db.from('users').where('age', '>=', '34').where('name','=','Louie').get();
// console.log(results);



