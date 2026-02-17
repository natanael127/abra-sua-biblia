#!/usr/bin/env python3
"""
Script para gerar automaticamente o arquivo index.json
a partir dos arquivos de bíblia (.ebf1.json) encontrados nos diretórios configurados.
"""

import json
import os
from pathlib import Path
from typing import List, Dict

# Diretório base onde este script está localizado
BASE_DIR = Path(__file__).parent

# Lista de diretórios a serem escaneados (relativo ao BASE_DIR)
# Adicione novos diretórios aqui conforme necessário
BIBLE_DIRECTORIES = [
    "catholic-open/json",
    # Adicione outros diretórios aqui, ex:
    # "protestant/json",
    # "orthodox/json",
]

# Padrão de arquivo para bíblias
BIBLE_FILE_PATTERN = "*.ebf1.json"

# Arquivo de saída
OUTPUT_FILE = BASE_DIR / "index.json"


def extract_bible_info(file_path: Path) -> Dict[str, str]:
    """
    Extrai informações da bíblia a partir do arquivo JSON.
    
    Args:
        file_path: Caminho para o arquivo .ebf1.json
        
    Returns:
        Dicionário com id e name da bíblia
    """
    with open(file_path, 'r', encoding='utf-8') as f:
        data = json.load(f)
    
    # O ID é extraído do nome do arquivo (sem a extensão .ebf1.json)
    bible_id = file_path.stem.replace('.ebf1', '')
    
    # O nome é extraído do conteúdo do arquivo
    bible_name = data.get('bible', {}).get('name', bible_id)
    
    return {
        "id": bible_id,
        "name": bible_name
    }


def scan_directory(directory: Path) -> List[Dict[str, str]]:
    """
    Escaneia um diretório em busca de arquivos de bíblia.
    
    Args:
        directory: Caminho do diretório a ser escaneado
        
    Returns:
        Lista de dicionários com informações das bíblias encontradas
    """
    bibles = []
    
    if not directory.exists():
        print(f"Aviso: Diretório não encontrado: {directory}")
        return bibles
    
    for file_path in sorted(directory.glob(BIBLE_FILE_PATTERN)):
        try:
            bible_info = extract_bible_info(file_path)
            bibles.append(bible_info)
            print(f"  Encontrado: {bible_info['name']} ({bible_info['id']})")
        except Exception as e:
            print(f"  Erro ao processar {file_path.name}: {e}")
    
    return bibles


def build_index() -> List[Dict[str, str]]:
    """
    Constrói o índice completo escaneando todos os diretórios configurados.
    
    Returns:
        Lista de dicionários com todas as bíblias encontradas
    """
    all_bibles = []
    
    for rel_dir in BIBLE_DIRECTORIES:
        directory = BASE_DIR / rel_dir
        print(f"Escaneando: {rel_dir}")
        bibles = scan_directory(directory)
        all_bibles.extend(bibles)
    
    # Remove duplicatas baseado no ID (mantém a primeira ocorrência)
    seen_ids = set()
    unique_bibles = []
    for bible in all_bibles:
        if bible['id'] not in seen_ids:
            seen_ids.add(bible['id'])
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
