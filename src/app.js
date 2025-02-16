import { Network } from 'vis-network';
import { DataSet } from 'vis-data';

const fs = require('fs').promises;
import path from 'path';




document.addEventListener('DOMContentLoaded', () => {
    let currentDB = '';
    let currentTable = '';
    let btreeNetwork = null;

    // Storage system
    const Storage = {
        getDBs: () => JSON.parse(localStorage.getItem('dbs') || '{}'),
        saveDBs: (dbs) => localStorage.setItem('dbs', JSON.stringify(dbs)),
        
        getTables: (db) => JSON.parse(localStorage.getItem(`db_${db}`) || '{}'),
        saveTables: (db, tables) => localStorage.setItem(`db_${db}`, JSON.stringify(tables)),
        
        getRecords: (db, table) => JSON.parse(localStorage.getItem(`table_${db}_${table}`) || '[]'),
        saveRecords: (db, table, records) => {
            localStorage.setItem(`table_${db}_${table}`, JSON.stringify(records))
        },

        addToDisk: (db, table, record) => {
            let blocks = Storage.getBlocks();
            const recordLength = Object.keys(record).length * (table.includes('index')?4:16);
            let availableBlock = blocks.filter(block => block.db === db && block.table === table && (block.current_length + recordLength)  <= 64);
            
            let blockId = null;
            if (!availableBlock || availableBlock.length === 0) {
                blockId = Storage.getNextBlockId();
                blocks.push({
                    "id":blockId,
                    db,
                    table,
                    current_length: recordLength
                });
                Storage.updateNextBlockId();
            } else {
                blockId = availableBlock[0].id;
                blocks = blocks.map(block => {if(block.id === blockId){block.current_length += recordLength;} return block});
            }
            record.blockId = blockId;
            Storage.saveBlocks(blocks);
            return blockId;
        },
        
        addRecord: (db, table, record) => {
            const records = Storage.getRecords(db, table);
            const blockId = Storage.addToDisk(db,table,record);
            Storage.addIndex(db, table, record, blockId);
            records.push(record);
            Storage.saveRecords(db, table, records);
            
            Storage.updateNextId(db, table);
        },

        addIndex: (db, recordTable, sourceRecord, blockId) => {
            const table = `${recordTable}_index`;
            const records = Storage.getRecords(db, table);
            let record = {
                id: records.length + 1,
                recordId: sourceRecord.id,
                recordBlockId: blockId
            };

            Storage.addToDisk(db,table,record);
            records.push(record);
            Storage.saveRecords(db, table, records);
            Storage.updateNextId(db, table);
        },

        getDisk: () => {
            const disk = localStorage.getItem(`disk`);
            if (!disk) {
                localStorage.setItem(`disk`, JSON.stringify({"nextId":1, "blocks":[]}));
            }
            return JSON.parse(localStorage.getItem(`disk`));
        },
        
        getBlocks: () => Storage.getDisk()?.blocks || [],

        saveBlocks: (blocks) => {
            const disk = Storage.getDisk();
            disk.blocks = blocks;
            disk.nextId = (blocks[blocks.length-1]?.id || 0) + 1;
            localStorage.setItem(`disk`, JSON.stringify(disk));
        },
        
        getNextId: (db, table) => {
            const tables = Storage.getTables(db);
            return tables[table]?.nextId || 1;
        },

        getNextBlockId: () => {
            const disk = Storage.getDisk();
            if(disk?.blocks.length === 0){
                return 1;
            }

            return (disk?.nextId || 1);
        },

        updateNextId: (db, table) => {
            const tables = Storage.getTables(db);
            if (!tables[table]) return;
            tables[table].nextId = (tables[table].nextId || 1) + 1;
            Storage.saveTables(db, tables);
        },
        
        updateNextBlockId: () => {
            const disk = Storage.getDisk();
            disk.nextId = (disk.nextId || 1) + 1;
            localStorage.setItem(`disk`, JSON.stringify(disk));
        }
    };

    // Page navigation
    function showPage(pageId) {
        document.querySelectorAll('.page').forEach(p => p.classList.remove('active-page'));
        document.getElementById(pageId).classList.add('active-page');
        
        if(pageId === 'database-page') renderDatabases();
        if(pageId === 'table-page') {
            document.getElementById('current-db').textContent = currentDB;
            renderTables();
        }
        if(pageId === 'table-details-page') {
            document.getElementById('current-table').textContent = currentTable;
            renderRecords();
            renderIndexes();
            renderBTree();
            renderDisk();
        }
    }

    // Database operations
    function showCreateDatabase() {
        const name = prompt('Enter database name:');
        if(name) {
            const dbs = Storage.getDBs();
            if(!dbs[name]) {
                dbs[name] = {};
                Storage.saveDBs(dbs);
                renderDatabases();
            } else {
                alert('Database already exists!');
            }
        }
    }

    // Table operations
    function showCreateTable() {
        const tableName = prompt('Enter table name:');
        if(!tableName) return;

        const fields = [];
        for(let i = 0; i < 3; i++) {
            const field = prompt(`Enter field ${i+1} name (or cancel to stop):`);
            if(!field) break;
            fields.push(field);
        }

        const tables = Storage.getTables(currentDB);
        tables[tableName] = { 
            fields,
            nextId: 1
        };
        Storage.saveTables(currentDB, tables);
        renderTables();
    }

    // Record operations
    function showCreateRecord() {
        const tables = Storage.getTables(currentDB);
        const table = tables[currentTable];
        const nextId = Storage.getNextId(currentDB, currentTable);
        
        const record = { id: nextId };
        table.fields.forEach(field => {
            const value = prompt(`Enter value for ${field}:`);
            record[field] = value || '';
        });

        Storage.addRecord(currentDB, currentTable, record);
        
        renderRecords();
        renderIndexes();
        renderDisk();
        renderBTree();
    }

    // Rendering functions
    function renderDatabases() {
        const dbs = Storage.getDBs();
        document.getElementById('database-list').innerHTML = 
            Object.keys(dbs).map(db => `
                <div class="list-item" data-db="${db}">
                    ${db}
                </div>
            `).join('');
        
        // Add click handlers for database items
        document.querySelectorAll('[data-db]').forEach(el => {
            el.addEventListener('click', () => {
                currentDB = el.dataset.db;
                showPage('table-page');
            });
        });
    }

    function renderTables() {
        const tables = Storage.getTables(currentDB);
        document.getElementById('table-list').innerHTML = 
            Object.keys(tables).map(table => `
                <div class="list-item" data-table="${table}">
                    ${table} (${tables[table].fields.join(', ')})
                </div>
            `).join('');
        
        // Add click handlers for table items
        document.querySelectorAll('[data-table]').forEach(el => {
            el.addEventListener('click', () => {
                currentTable = el.dataset.table;
                showPage('table-details-page');
            });
        });
    }

    function renderRecords() {
        const records = Storage.getRecords(currentDB, currentTable);
        const fields = Object.keys(records[0])
        
        // Create the table header row
        document.getElementById('record-list').innerHTML = `
            <table class="records-table">
                <thead>
                    <tr class="header">
                        ${fields.map(field => `<th>${field}</th>`).join('')}
                    </tr>
                </thead>
                <tbody>
                    <!-- table rows will be generated here -->
                </tbody>
            </table>
        `;
        
        // Add each record as a table row
        const tbody = document.querySelector('#record-list tbody');
        records.forEach(record => {
            const row = document.createElement('tr');
            
            fields.forEach((field, index) => {
                const cell = document.createElement('td');
                cell.textContent = `${record[field]}`;
                cell.className = 'block-cell';
                row.appendChild(cell);
                row.classList.add('active');
                row.classList.add('records-row');
                row.setAttribute("data-record",record.id);
                row.setAttribute("data-block",record.blockId);
                row.addEventListener('mouseenter', () => { highlightSector(row, 'record')});
                row.addEventListener('mouseleave', () => { unhighlightSector(row, 'record')});
                tbody.appendChild(row);
            });
        });
    }

    function renderIndexes() {
        const records = Storage.getRecords(currentDB, `${currentTable}_index`);
        const fields = Object.keys(records[0])
        
        // Create the table header row
        document.getElementById('index-list').innerHTML = `
            <table class="records-table">
                <thead>
                    <tr class="header">
                        ${fields.map(field => `<th>${field}</th>`).join('')}
                    </tr>
                </thead>
                <tbody>
                    <!-- table rows will be generated here -->
                </tbody>
            </table>
        `;
        
        // Add each record as a table row
        const tbody = document.querySelector('#index-list tbody');
        records.forEach(record => {
            const row = document.createElement('tr');
            
            fields.forEach((field, index) => {
                const cell = document.createElement('td');
                cell.textContent = `${record[field]}`;
                cell.className = 'block-cell';
                row.appendChild(cell);
                row.classList.add('active');
                row.classList.add('records-row');
                row.setAttribute("data-index",record.id);
                row.setAttribute("data-block",record.blockId);
                row.addEventListener('mouseenter', () => { highlightSector(row, 'index')});
                row.addEventListener('mouseleave', () => { unhighlightSector(row, 'index')});
                tbody.appendChild(row);
            });
        });
    }

    function renderDisk() {
        //deduplicate chsTuples
        const blocks = Storage.getBlocks();

        const visual = document.getElementById('disk-visual');
        visual.innerHTML = '';
 
        blocks.forEach((block) => {
            const id = block.id;
            const segment = document.createElement('div');
            
            const sectorLimit = 10;
            const sector = (id) % sectorLimit;
            const cylinder = Math.floor((id) / sectorLimit);

            // Calculate positioning
            const cylinderRadius = 400 - (cylinder* 80); // px from center
            const sectorAngle = 360/sectorLimit; // 10 sectors = 36° each
            const rotation = (sector * sectorAngle);
            segment.id = `block-${id}`;
            segment.className = 'sector-segment';
            segment.style.position = "absolute";
            segment.style.rotate = `${rotation}deg`;
            segment.style.width = `${cylinderRadius}px`;
            segment.style["aspect-ratio"] = "1";
            segment.style.padding = "38px";
            segment.style["box-sizing"] = "border-box";
            segment.style["border-radius"] = "50%";
            segment.style.background = "#c0d860";
            segment.style.mask = `linear-gradient(#0000 0 0) content-box intersect, conic-gradient(#000 ${sectorAngle-1}deg,#0000 0)`;            
            visual.appendChild(segment);
        });
    }

    // B+ Tree implementation
    class BPlusTree {
        constructor(order = 3) {
            this.order = order;
            this.root = { keys: [], children: [], isLeaf: true };
        }

        insert(key) {
            let node = this.root;
            const stack = [];

            while (!node.isLeaf) {
                let index = 0;
                while (index < node.keys.length && key > node.keys[index]) index++;
                stack.push({ node, index });
                node = node.children[index];
            }

            let pos = 0;
            while (pos < node.keys.length && key > node.keys[pos]) pos++;
            node.keys.splice(pos, 0, key);

            while (node.keys.length > this.order) {
                const splitIndex = Math.floor(node.keys.length / 2);
                const newKey = node.keys[splitIndex];
                const newNode = {
                    keys: node.keys.splice(splitIndex),
                    children: node.children.splice(splitIndex),
                    isLeaf: node.isLeaf
                };

                if (stack.length === 0) {
                    const newRoot = {
                        keys: [newKey],
                        children: [node, newNode],
                        isLeaf: false
                    };
                    this.root = newRoot;
                    return;
                }

                const parent = stack.pop().node;
                const parentIndex = stack.pop()?.index || 0;
                parent.keys.splice(parentIndex, 0, newKey);
                parent.children.splice(parentIndex + 1, 0, newNode);
                node = parent;
            }
        }

        getTreeData() {
            const nodes = [];
            const edges = [];
            let idCounter = 1;

            const traverse = (node, level) => {
                const nodeId = idCounter++;
                nodes.push({
                    id: nodeId,
                    label: node.keys.join('|'),
                    level: -level,
                    shape: 'box'
                });

                if (!node.isLeaf) {
                    node.children.forEach(child => {
                        const childId = traverse(child, level + 1);
                        edges.push({ from: nodeId, to: childId });
                    });
                }
                return nodeId;
            };

            traverse(this.root, 0);
            return { nodes, edges };
        }
    }

    function renderBTree() {
        const records = Storage.getRecords(currentDB, currentTable);
        if (records.length === 0) return;

        const tree = new BPlusTree();
        records.forEach(r => tree.insert(r.id));
        const { nodes, edges } = tree.getTreeData();

        const container = document.getElementById('btree-visual');
        const options = {
            layout: {
                hierarchical: {
                    direction: 'DU',
                    levelSeparation: 100,
                    nodeSpacing: 150
                }
            },
            physics: false,
            nodes: {
                font: { size: 14 },
                margin: 10
            }
        };

        if (btreeNetwork) btreeNetwork.destroy();
        btreeNetwork = new Network(container, { nodes, edges }, options);
    }

    // Highlight functions
    function highlightSector(element,type) {
        const id = parseInt(element.dataset[type]);
        const blockId = parseInt(element.dataset.block);
        document.querySelectorAll(`[data-record]`).forEach(el => {
            if(parseInt(el.dataset.record) === id){
                el.style.backgroundColor = '#ffeb3b';
            }
        });

        document.querySelectorAll(`[data-index]`).forEach(el => {
            if(parseInt(el.dataset.index) === id){
                el.style.backgroundColor = '#ffeb3b';
            }
        });

        let blockEl = document.getElementById(`block-${blockId}`);
        blockEl.style.backgroundColor = '#ffeb3b';
    }

    function unhighlightSector(element,type) {
        const id = parseInt(element.dataset[type]);
        const blockId = parseInt(element.dataset.block);
        document.querySelectorAll(`[data-record]`).forEach(el => {
            if(parseInt(el.dataset.record) === id){
                el.style.backgroundColor = '';
            }
        });

        document.querySelectorAll(`[data-index]`).forEach(el => {
            if(parseInt(el.dataset.index) === id){
                el.style.backgroundColor = '';
            }
        });

        let blockEl = document.getElementById(`block-${blockId}`);
        blockEl.style.backgroundColor = '#c0d860';
    }

    // Event listeners
    document.getElementById('create-db-btn').addEventListener('click', showCreateDatabase);
    document.getElementById('create-table-btn').addEventListener('click', showCreateTable);
    document.getElementById('add-record-btn').addEventListener('click', showCreateRecord);
    document.getElementById('back-to-db').addEventListener('click', () => showPage('database-page'));
    document.getElementById('back-to-tables').addEventListener('click', () => showPage('table-page'));

    // Initial render
    renderDatabases();
    fetch('initialdb.json')
        .then(response => response.text())
        .then(data => {
            console.log("Data: " + data);
            const parsedData = JSON.parse(data);
            Object.keys(parsedData).forEach(key => {
                localStorage.setItem(key, JSON.stringify(parsedData[key]));
            });
        })
    .catch(error => {
      console.error('Error reading file:', error);
    });
});