import fs from 'fs';
import path from 'path';

async function expandJsonFile(filePath) {
    try {
        // 1. 解析基础信息
        const dirName = path.basename(filePath, '.json');
        const outputDir = path.join(path.dirname(filePath), dirName);

        // 2. 创建输出目录
        if (!fs.existsSync(outputDir)) {
            fs.mkdirSync(outputDir, { recursive: true });
        }

        // 3. 读取并处理JSON数据
        const rawData = fs.readFileSync(filePath, 'utf8');
        const data = JSON.parse(rawData);

        for (const [key, value] of Object.entries(data)) {
            if (typeof value === 'object' && value !== null &&
                !(Array.isArray(value) && value.length === 0) &&
                !(Object.keys(value).length === 0)) {
                const outputPath = path.join(outputDir, `${key}.json`);
                fs.writeFileSync(
                    outputPath,
                    JSON.stringify(value, null, 2)
                );
                console.log(`Created: ${outputPath}`);
            }
        }

        return true;
    } catch (err) {
        console.error(`Error processing ${filePath}:`, err);
        return false;
    }
}

// 处理两个目标文件
(async () => {
    const filesToProcess = [
        'data/init_character_data.json',
        'data/init_client_data.json'
    ];

    for (const file of filesToProcess) {
        const success = await expandJsonFile(file);
        console.log(`${file} processed ${success ? 'successfully' : 'with errors'}`);
    }
})();