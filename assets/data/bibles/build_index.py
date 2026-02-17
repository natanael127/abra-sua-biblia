#!/usr/bin/env python3
"""
Script para gerar automaticamente o arquivo index.json
a partir dos arquivos de bíblia (.ebf1.json) encontrados nos diretórios configurados.
"""

import json
from pathlib import Path
from typing import List, Dict, Any, Optional

# Diretório base onde este script está localizado
BASE_DIR = Path(__file__).parent

# Lista de diretórios a serem escaneados (relativo ao BASE_DIR)
# Adicione novos diretórios aqui conforme necessário
BIBLE_DIRECTORIES = [
    ".",
]

# Padrão de arquivo para bíblias
BIBLE_FILE_PATTERN = "*.ebf1.json"

# Arquivo de saída
OUTPUT_FILE = BASE_DIR / "index.json"

# Bíblia padrão (path relativo ao BASE_DIR, ou None para não definir)
DEFAULT_BIBLE_PATH = "Ave-Maria.ebf1.json"

# Quantidade de livros por tipo de bíblia
BIBLE_TYPE_BOOKS = {
    "catholic": 73,    # 46 AT + 27 NT (inclui deuterocanônicos)
    "protestant": 66,  # 39 AT + 27 NT
}


def get_bible_type(num_books: int) -> str:
    """
    Determina o tipo da bíblia baseado na quantidade de livros.
    
    Args:
        num_books: Número de livros na bíblia
        
    Returns:
        'catholic', 'protestant' ou 'other'
    """
    for bible_type, expected_books in BIBLE_TYPE_BOOKS.items():
        if num_books == expected_books:
            return bible_type
    return "other"


def extract_bible_info(file_path: Path, base_dir: Path) -> Dict:
    """
    Extrai informações da bíblia a partir do arquivo JSON.
    
    Args:
        file_path: Caminho para o arquivo .ebf1.json
        base_dir: Diretório base (onde está o index.json)
        
    Returns:
        Dicionário com name, path, type e opcionalmente default
    """
    with open(file_path, 'r', encoding='utf-8') as f:
        data = json.load(f)
    
    # O nome é extraído do conteúdo do arquivo (será usado como ID e display)
    bible_id = file_path.stem.replace('.ebf1', '')
    bible_name = data.get('bible', {}).get('name', bible_id)
    
    # O path é relativo ao diretório base (onde está o index.json)
    relative_path = file_path.relative_to(base_dir).as_posix()
    
    # Determina o tipo baseado na quantidade de livros
    books = data.get('bible', {}).get('books', [])
    bible_type = get_bible_type(len(books))
    
    result = {
        "name": bible_name,
        "path": relative_path,
        "type": bible_type
    }
    
    # Adiciona campo default apenas se for a bíblia padrão
    if DEFAULT_BIBLE_PATH and relative_path == DEFAULT_BIBLE_PATH:
        result["default"] = True
    
    return result


def scan_directory(directory: Path, base_dir: Path) -> List[Dict[str, Any]]:
    """
    Escaneia um diretório em busca de arquivos de bíblia.
    
    Args:
        directory: Caminho do diretório a ser escaneado
        base_dir: Diretório base (onde está o index.json)
        
    Returns:
        Lista de dicionários com informações das bíblias encontradas
    """
    bibles = []
    
    if not directory.exists():
        print(f"Aviso: Diretório não encontrado: {directory}")
        return bibles
    
    for file_path in sorted(directory.glob(BIBLE_FILE_PATTERN)):
        try:
            bible_info = extract_bible_info(file_path, base_dir)
            bibles.append(bible_info)
            default_marker = " [PADRÃO]" if bible_info.get('default') else ""
            print(f"  Encontrado: {bible_info['name']} ({bible_info['type']}) -> {bible_info['path']}{default_marker}")
        except Exception as e:
            print(f"  Erro ao processar {file_path.name}: {e}")
    
    return bibles


def build_index() -> List[Dict[str, Any]]:
    """
    Constrói o índice completo escaneando todos os diretórios configurados.
    
    Returns:
        Lista de dicionários com todas as bíblias encontradas
    """
    all_bibles = []
    
    for rel_dir in BIBLE_DIRECTORIES:
        directory = BASE_DIR / rel_dir
        print(f"Escaneando: {rel_dir}")
        bibles = scan_directory(directory, BASE_DIR)
        all_bibles.extend(bibles)
    
    # Remove duplicatas baseado no nome (mantém a primeira ocorrência)
    seen_names = set()
    unique_bibles = []
    for bible in all_bibles:
        if bible['name'] not in seen_names:
            seen_names.add(bible['name'])
            unique_bibles.append(bible)
    
    return unique_bibles


def save_index(bibles: List[Dict[str, str]]) -> None:
    """
    Salva o índice no arquivo JSON.
    
    Args:
        bibles: Lista de dicionários com informações das bíblias
    """
    with open(OUTPUT_FILE, 'w', encoding='utf-8') as f:
        json.dump(bibles, f, ensure_ascii=False, indent=4)
        f.write('\n')

    print(f"\nÍndice salvo em: {OUTPUT_FILE}")
    print(f"Total de bíblias: {len(bibles)}")


def main():
    print("=== Gerador de Índice de Bíblias ===\n")
    
    bibles = build_index()
    
    if bibles:
        save_index(bibles)
    else:
        print("Nenhuma bíblia encontrada!")


if __name__ == "__main__":
    main()
