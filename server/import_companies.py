import os
import pandas as pd
from app.core.database import supabase

def main():
    df = pd.read_excel(r'assets\models\BTech_Companies_NLP (1).xlsx')
    df = df.fillna('')
    for _, row in df.iterrows():
        # Handle variants like "7.0+" or "Not Available"
        cpi_str = str(row.get('Minimum CPI/GPA', '')).replace('+', '').replace('Not Available', '').strip()
        cpi = 0.0
        try:
            if cpi_str: cpi = float(cpi_str)
        except:
            pass
            
        skills = [s.strip() for s in str(row.get('Required Skills', '')).split(',') if s.strip()]
        
        proj_count_str = str(row.get('No of Projects', '')).replace('+', '').strip()
        proj_count = 0
        try:
            if proj_count_str: proj_count = int(proj_count_str)
        except:
            pass
            
        proj_keywords = [k.strip() for k in str(row.get('Key words in project', '')).split(',') if k.strip()]
        
        branches = [b.strip() for b in str(row.get('Branches Invited', '')).split(',') if b.strip()]
        
        core_skills_raw = str(row.get('CORE COMPUTER SKILLS', ''))
        core_skills = [c.strip() for c in core_skills_raw.split(',') if c.strip() and c.strip().lower() != 'none']
        
        company_data = {
            'name': str(row.get('Company Name', '')),
            'cpi': cpi,
            'skill_set': skills,
            'internship_role': str(row.get('Internship Role', '')),
            'visits_iit_patna': str(row.get('Visits IIT Patna ', '')).strip().upper() == 'YES',
            'min_projects': proj_count,
            'project_keywords': proj_keywords,
            'branch': branches,
            'dsa_required': str(row.get('DSA REQUIRED', '')).strip().upper() == 'YES',
            'core_skills': core_skills
        }
        
        if not company_data['name']:
            continue
            
        print(f"Checking existing company {company_data['name']}...")
        existing = supabase.table('companies').select('id').eq('name', company_data['name']).execute()
        
        if existing.data:
            print(f"Company {company_data['name']} already exists. Updating...")
            res = supabase.table('companies').update(company_data).eq('id', existing.data[0]['id']).execute()
        else:
            print(f"Inserting new company {company_data['name']}...")
            res = supabase.table('companies').insert(company_data).execute()
        
        print("Success:", bool(res.data))

if __name__ == '__main__':
    main()
