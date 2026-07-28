import pandas as pd
import uuid
import math

# Read the Excel file
df = pd.read_excel('assets/models/BTech_Companies_NLP (1).xlsx')

sql_statements = []
sql_statements.append("-- Run this in the Supabase SQL Editor to seed the companies table")
sql_statements.append("INSERT INTO companies (id, name, cpi, skill_set, min_projects, project_keywords, branch, core_skills, created_at)")
sql_statements.append("VALUES")

values = []
for index, row in df.iterrows():
    company_id = str(uuid.uuid4())
    name = str(row['Company Name']).replace("'", "''")
    
    # Parse CPI
    cpi_str = str(row['Minimum CPI/GPA']).replace('+', '').strip()
    try:
        cpi = float(cpi_str)
    except ValueError:
        cpi = 0.0
        
    # Helper to parse lists
    def parse_list(val):
        if pd.isna(val):
            return "ARRAY[]::text[]"
        items = [i.strip().replace("'", "''") for i in str(val).split(',')]
        return "ARRAY[" + ", ".join(f"'{i}'" for i in items if i) + "]::text[]"
        
    skill_set = parse_list(row['Required Skills'])
    
    internship_role = str(row['Internship Role']).replace("'", "''") if pd.notna(row['Internship Role']) else ""
    
    visits_iit = 'true' if str(row['Visits IIT Patna ']).strip().upper() == 'YES' else 'false'
    
    try:
        min_projects = int(row['No of Projects'])
    except ValueError:
        min_projects = 0
        
    project_keywords = parse_list(row['Key words in project'])
    branch = parse_list(row['Branches Invited'])
    
    dsa_required = 'true' if str(row['DSA REQUIRED']).strip().upper() == 'YES' else 'false'
    
    core_skills = parse_list(row['CORE COMPUTER SKILLS'])
    
    val_str = f"('{company_id}', '{name}', {cpi}, {skill_set}, {min_projects}, {project_keywords}, {branch}, {core_skills}, now())"
    values.append(val_str)

sql_statements.append(",\n".join(values) + ";")

with open('seed_companies.sql', 'w') as f:
    f.write("\n".join(sql_statements))

print("Successfully generated seed_companies.sql")
