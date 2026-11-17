/**
 * Gestión de Guardado y Carga de Escenarios en formato JSON
 */
export class Storage {
  /**
   * Exporta la configuración actual de la cuadrícula a un archivo .json descargable
   */
  static exportToJSON(gridMap, filename = 'fuzzydrive_escenario.json') {
    const data = gridMap.toJSON();
    const jsonStr = JSON.stringify(data, null, 2);
    const blob = new Blob([jsonStr], { type: 'application/json' });
    const url = URL.createObjectURL(blob);

    const a = document.createElement('a');
    a.href = url;
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  }

  /**
   * Importa un archivo .json seleccionado por el usuario y actualiza la cuadrícula
   */
  static importFromJSON(file, gridMap, onLoaded) {
    const reader = new FileReader();
    reader.onload = (e) => {
      try {
        const data = JSON.parse(e.target.result);
        gridMap.fromJSON(data);
        if (onLoaded) onLoaded();
      } catch (err) {
        alert('Error al leer el archivo JSON: ' + err.message);
      }
    };
    reader.readAsText(file);
  }
}
