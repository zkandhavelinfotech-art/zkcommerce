with open('zkc/store-builder/index.html', 'r', encoding='utf-8') as f:
    text = f.read()

ids = [
    'chk_additional_note', 'input_additional_note', 'wrap_additional_note', 
    'preview_additional_note_badge', 'card_additional_note', 
    'chk_user_instructions', 'input_user_instructions', 'wrap_user_instructions', 'card_user_instructions', 
    'chk_benefits', 'input_benefits', 'wrap_benefits', 'card_benefits', 
    'productModalTitle', 'productModal', 'productForm'
]

for i in ids:
    count = text.count(f'id="{i}"') + text.count(f"id='{i}'")
    print(f'{i}: {count}')
