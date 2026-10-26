import json
import sqlite3
from analysis import ROOT,database,read_only_sql

def evaluate():
    cases=json.loads((ROOT/'sql-eval-cases.json').read_text(encoding='utf-8'))
    connection=database()
    results=[]
    try:
        for item in cases:
            try:
                rows=read_only_sql(connection,item['sql'])
                results.append({'id':item['id'],'denied':False,'semantic_match':rows==item.get('expected'),'known_semantic_error':item.get('known_semantic_error',False)})
            except (ValueError,sqlite3.DatabaseError):
                results.append({'id':item['id'],'denied':True,'expected_denial':item.get('expected_denial',False)})
    finally:
        connection.close()
    return results

if __name__=='__main__':
    print(json.dumps(evaluate(),ensure_ascii=False,indent=2))
