document.addEventListener('DOMContentLoaded', () => {
    const logFile = document.getElementById('logFile');
    const resultsSection = document.getElementById('resultsSection');
    const summaryDiv = document.getElementById('summary');
    const errorSection = document.getElementById('errorSection');
    const errorMessageP = document.getElementById('errorMessage');
    // 🔽 新しく追加した「全員分コピー」ボタンの要素
    const copyAllButton = document.getElementById('copyAllButton');
    // copySelectedButtonは使用しないため削除

    let currentResults = {}; // 🔽 解析結果を保持する変数

    // ファイルが選択されたらボタンを有効化 (ロジック修正)
    logFile.addEventListener('change', () => {
        resultsSection.classList.add('hidden');
        errorSection.classList.add('hidden');
        summaryDiv.innerHTML = '';
        copyAllButton.classList.add('hidden'); // ファイル変更で非表示に
        const file = logFile.files[0];
        if (!file) {
            showError("ファイルが選択されていません。");
            return;
        }

        const reader = new FileReader();
        reader.onload = (e) => {
            const htmlContent = e.target.result;
            try {
                currentResults = analyzeCoCLog(htmlContent); // 結果を保存
                displayResults(currentResults);
            } catch (error) {
                console.error(error);
                showError("ログファイルの解析中にエラーが発生しました。ファイル形式を確認してください。");
            }
        };
        reader.onerror = () => {
            showError("ファイルを読み込めませんでした。");
        };
        reader.readAsText(file);
    });

    // 🔽 全員分コピーボタンのイベントリスナーを追加
    copyAllButton.addEventListener('click', () => {
        copyAllResultsToClipboard(currentResults, copyAllButton);
    });

    /**
     * エラーメッセージを表示する (変更なし)
     * @param {string} message - 表示するエラーメッセージ
     */
    function showError(message) {
        errorMessageP.textContent = message;
        errorSection.classList.remove('hidden');
        resultsSection.classList.add('hidden');
        copyAllButton.classList.add('hidden'); // エラー時は非表示
    }

    /**
     * CoCログHTMLの内容を解析し、クリティカル/ファンブルを集計する (変更なし)
     */
    function analyzeCoCLog(htmlContent) {
        const parser = new DOMParser();
        const doc = parser.parseFromString(htmlContent, 'text/html');

        const charResults = {};

        const CRITICAL_RESULTS = ["決定的成功/スペシャル", "決定的成功"];
        const FUMBLE_RESULTS = ["致命的失敗"];
        const IGNORE_CHARS = ["KP", "system"];

        // より柔軟な正規表現
        const rollPattern = /CCB<=.*?【([^】]+)】.*?＞\s*\d+\s*＞\s*(決定的成功\/スペシャル|決定的成功|スペシャル|致命的失敗|成功|失敗)/;

        const logEntries = doc.querySelectorAll('p');

        logEntries.forEach(pTag => {
            const spans = pTag.querySelectorAll('span');
            if (spans.length < 2) return;

            // キャラ名と発言を末尾から安全に取得
            const charNameRaw = spans[spans.length - 2].textContent.trim();
            const rollContent = spans[spans.length - 1].textContent.trim();

            if (IGNORE_CHARS.includes(charNameRaw)) return;

            const charName = charNameRaw.replace(/\s+/g, ' ').trim();
            const match = rollContent.match(rollPattern);
            if (!match) return;

            const skillName = match[1].trim();
            const rollResultText = match[2].trim();

            if (!charResults[charName]) {
                charResults[charName] = {
                    totalCritical: 0,
                    totalFumble: 0,
                    totalSuccess: 0,
                    totalRolls: 0,
                    criticalSkills: {},
                    fumbleSkills: {}
                };
            }
            const data = charResults[charName];

            // 総判定数をインクリメント
            data.totalRolls++;

            // 判定結果ごとに処理
            if (CRITICAL_RESULTS.includes(rollResultText)) {
                data.totalCritical++;
                data.totalSuccess++;
                data.criticalSkills[skillName] = (data.criticalSkills[skillName] || 0) + 1;
            } else if (FUMBLE_RESULTS.includes(rollResultText)) {
                data.totalFumble++;
                data.fumbleSkills[skillName] = (data.fumbleSkills[skillName] || 0) + 1;
            } else if (rollResultText === "成功") {
                data.totalSuccess++;
            }

        });

        return charResults;
    }


    /**
     * 解析結果をウェブサイトに表示する
     * @param {Object} results - キャラクターごとの集計結果
     */
    function displayResults(results) {
        summaryDiv.innerHTML = ''; // 結果をクリア

        const charNames = Object.keys(results);
        if (charNames.length === 0) {
            showError("ログファイルから有効なCCBロールを見つけられませんでした。");
            return;
        }

        // 判定回数順に並べ替え
        const sortedChars = charNames.sort((a, b) => results[b].totalRolls - results[a].totalRolls);

        sortedChars.forEach((charName, index) => { // 🔽 indexを追加
            const data = results[charName];
            const charDiv = document.createElement('div');
            // 🔽 【変更】削除用にIDを設定
            charDiv.className = 'char-result';
            charDiv.id = `result-${index}`;

            // 技能リストのHTML文字列を生成
            const criticalSkillsHtml = Object.keys(data.criticalSkills).sort().map(skill =>
                `<li>${skill}: ${data.criticalSkills[skill]} 回</li>`
            ).join('') || '<li>なし</li>';

            const fumbleSkillsHtml = Object.keys(data.fumbleSkills).sort().map(skill =>
                `<li>${skill}: ${data.fumbleSkills[skill]} 回</li>`
            ).join('') || '<li>なし</li>';

            charDiv.innerHTML = `
            <button class="delete-button" data-char-id="${charDiv.id}" aria-label="この探索者の結果を削除">×</button>
                
                <h3>${charName}</h3>
                <button class="copy-button" data-char-name="${charName}">結果をコピー</button> 
                
                <table class="summary-table">
                    <tr>
                        <th>判定合計</th>
                        <td>${data.totalRolls} 回</td>
                    </tr>
                    <tr>
                        <th>クリティカル合計</th>
                        <td class="critical">${data.totalCritical} 回</td>
                    </tr>
                    <tr>
                        <th>ファンブル合計</th>
                        <td class="fumble">${data.totalFumble} 回</td>
                    </tr>
                    <tr>
                        <th>ファンブル確率</th>
                        <td>${(data.totalRolls ? (data.totalFumble / data.totalRolls * 100).toFixed(2) : 0)} %</td>
                    </tr>
                    <tr>
                        <th>クリティカル確率（成功内）</th>
                        <td>${(data.totalSuccess ? (data.totalCritical / data.totalSuccess * 100).toFixed(2) : 0)} %</td>
                    </tr>
                    <tr>
                        <th>平均成功確率</th>
                        <td>${(data.totalRolls ? (data.totalSuccess / data.totalRolls * 100).toFixed(2) : 0)} %</td>
                    </tr>
                </table>

                <h4>クリティカルした技能</h4>
                <ul>
                    ${criticalSkillsHtml}
                </ul>

                <h4>ファンブルした技能</h4>
                <ul>
                    ${fumbleSkillsHtml}
                </ul>
            `;
            summaryDiv.appendChild(charDiv);

            // 🔽 【追加】削除ボタンにイベントリスナーを追加
            const deleteButton = charDiv.querySelector('.delete-button');
            deleteButton.addEventListener('click', (e) => {
                const id = e.target.dataset.charId;
                const elementToDelete = document.getElementById(id);
                if (elementToDelete) {
                    elementToDelete.remove();
                }
                // もし結果が全て削除されたら、ボタン類も非表示にする
                if (summaryDiv.children.length === 0) {
                    resultsSection.classList.add('hidden');
                }
            });


            // 各探索者用のコピーボタンにイベントリスナーを追加 (変更なし)
            const copyButton = charDiv.querySelector('.copy-button');
            copyButton.addEventListener('click', () => {
                copyResultsToClipboard(charName, data, copyButton);
            });
        });

        resultsSection.classList.remove('hidden');
        errorSection.classList.add('hidden');
        copyAllButton.classList.remove('hidden'); // 成功時に表示

    }

    /**
     * 特定の探索者のクリティカル・ファンブル結果を整形してクリップボードにコピーする (変更なし)
     */
    function copyResultsToClipboard(charName, data, button) {
        // 技能リストを「技能: 回数」の形式で改行区切りで整形
        const formatSkills = (skillData) => {
            return Object.keys(skillData).sort().map(skill =>
                `${skill}: ${skillData[skill]}回`
            ).join('\n　');
        };

        const criticalList = formatSkills(data.criticalSkills) || '（なし）';
        const fumbleList = formatSkills(data.fumbleSkills) || '（なし）';

        const copyText =
            `${charName}
--------------------
判定合計: ${data.totalRolls}回 (成功率: ${(data.totalRolls ? (data.totalSuccess / data.totalRolls * 100).toFixed(2) : 0)} %)
クリティカル合計: ${data.totalCritical}回
ファンブル合計: ${data.totalFumble}回

クリティカルした技能:
　${criticalList}

ファンブルした技能:
　${fumbleList}`;

        navigator.clipboard.writeText(copyText)
            .then(() => {
                // コピー成功時のフィードバック
                button.textContent = 'コピーしました！';
                setTimeout(() => {
                    button.textContent = '結果をコピー';
                }, 1500);
            })
            .catch(err => {
                console.error('クリップボードへのコピーに失敗しました:', err);
                button.textContent = 'コピー失敗';
            });
    }

    /**
     * 🔽 全探索者のクリティカル・ファンブル結果をまとめてクリップボードにコピーする (変更なし)
     * @param {Object} results - 全キャラクターの解析データ
     * @param {HTMLElement} button - クリックされたボタン要素
     */
    function copyAllResultsToClipboard(results, button) {
        // 画面に残っている結果のみをコピー対象とする
        const displayedCharNames = Array.from(summaryDiv.querySelectorAll('.char-result'))
            .map(div => div.querySelector('h3').textContent.replace('探索者: ', '').trim());

        if (displayedCharNames.length === 0) {
            alert("コピーする解析結果がありません。ファイルを解析するか、結果を削除しすぎないでください。");
            return;
        }

        let combinedText = "";

        // 技能リストを「技能: 回数」の形式で改行区切りで整形
        const formatSkills = (skillData) => {
            return Object.keys(skillData).sort().map(skill =>
                `${skill}: ${skillData[skill]}回`
            ).join('\n　');
        };

        // 表示中の探索者のデータのみを処理する
        const sortedDisplayedChars = displayedCharNames.sort((a, b) => {
            const resultA = results[a] || { totalRolls: 0 };
            const resultB = results[b] || { totalRolls: 0 };
            return resultB.totalRolls - resultA.totalRolls;
        });

        sortedDisplayedChars.forEach(charName => {
            const data = results[charName];

            const criticalList = formatSkills(data.criticalSkills) || '（なし）';
            const fumbleList = formatSkills(data.fumbleSkills) || '（なし）';

            const charSummary =
                `◆ ${charName}
--------------------
判定合計: ${data.totalRolls}回 (成功率: ${(data.totalRolls ? (data.totalSuccess / data.totalRolls * 100).toFixed(2) : 0)} %)
クリティカル: ${data.totalCritical}回 / ファンブル: ${data.totalFumble}回

クリティカルした技能:
　${criticalList}

ファンブルした技能:
　${fumbleList}
\n\n`; // キャラクター間に区切りと改行を追加

            combinedText += charSummary;
        });

        // 最後に不要な改行を削除
        combinedText = combinedText.trim();

        navigator.clipboard.writeText(combinedText)
            .then(() => {
                // コピー成功時のフィードバック
                const originalText = button.textContent;
                button.textContent = '全員分コピーしました！';
                setTimeout(() => {
                    button.textContent = originalText;
                }, 1500);
            })
            .catch(err => {
                console.error('クリップボードへのコピーに失敗しました:', err);
                button.textContent = 'コピー失敗';
            });
    }

});

const pagetop_btn = document.querySelector(".button-20");

// .pagetopをクリックしたら
pagetop_btn.addEventListener("click", scroll_top);
// ページ上部へスムーズに移動
function scroll_top() {
    window.scroll({ top: 0, behavior: "smooth" });
}